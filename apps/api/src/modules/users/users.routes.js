import fastifyMultipart from '@fastify/multipart';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { requestTiming } from '@coderank/core/shared/request-timing';
import { requireAdmin } from '../../middleware/authentication.js';
import { UsersService } from './users.service.js';

export default async function usersRoutes(fastify) {
  fastify.decorateRequest('actor', null);

  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 10,
    },
  });

  fastify.removeContentTypeParser('application/json');
  fastify.removeContentTypeParser('text/plain');
  const parseJson = (request, body, done) => {
    try {
      done(null, JSON.parse(body));
    } catch {
      done(Object.assign(new Error('Invalid JSON payload'), { code: 'USERS_INVALID_JSON', statusCode: 400 }));
    }
  };
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, parseJson);
  fastify.addContentTypeParser('*', { parseAs: 'string' }, parseJson);

  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    return payload;
  });

  fastify.setErrorHandler((error, request, reply) => {
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return reply.code(400).send({ error: 'Invalid multipart payload' });
    }
    const status = error.statusCode || error.status || 500;
    const invalidJson = error.code === 'USERS_INVALID_JSON' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY';
    const message = invalidJson
      ? 'Invalid JSON payload'
      : status === 413
        ? 'Request body is too large'
        : status < 500
          ? error.message
          : 'Internal server error';
    reply.code(status).send({ error: message });
  });

  async function readMultipart(request) {
    if (!request.isMultipart?.()) {
      throw Object.assign(new Error('Invalid multipart payload'), { status: 400 });
    }
    let role = null;
    let fileBuffer = null;
    let fileName = null;
    let fileSize = 0;
    let truncated = false;
    try {
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          if (part.fieldname === 'role') {
            role = typeof part.value === 'string' ? part.value.trim() : part.value;
          }
        } else if (part.type === 'file') {
          if (part.fieldname === 'file') {
            fileName = part.filename;
            const chunks = [];
            for await (const chunk of part.file) {
              fileSize += chunk.length;
              if (fileSize > 10 * 1024 * 1024) {
                truncated = true;
                part.file.resume();
                break;
              }
              chunks.push(chunk);
            }
            if (part.file.truncated) truncated = true;
            fileBuffer = Buffer.concat(chunks);
          } else {
            part.file.resume();
          }
        }
      }
    } catch {
      throw Object.assign(new Error('Invalid multipart payload'), { status: 400 });
    }
    return { role, fileBuffer, fileName, fileSize, truncated };
  }

  // POST /admin/bulk-upload — admin multipart CSV/Excel ingestion
  fastify.post('/admin/bulk-upload', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const { role, fileBuffer, fileName, fileSize, truncated } = await readMultipart(request);

      if (!fileBuffer || typeof fileName !== 'string' || !role) {
        return reply.status(400).send({ error: 'File and role are required' });
      }

      if (role !== 'faculty' && role !== 'student') {
        return reply.status(400).send({ error: 'Invalid role parameter' });
      }

      const fileExt = path.extname(fileName).toLowerCase();
      if (!['.csv', '.xlsx'].includes(fileExt)) {
        return reply.status(400).send({ error: 'Unsupported file type. Only CSV and Excel files are allowed.' });
      }

      if (truncated || fileSize > 5 * 1024 * 1024 || fileBuffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({ error: 'File size exceeds 5MB limit' });
      }

      let parsedUsers = [];
      try {
        if (fileExt === '.csv') {
          const records = parse(fileBuffer.toString('utf-8'), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });

          parsedUsers = records.map((r) => ({
            first_name: r.first_name || r.firstName || r.name?.split(' ')[0] || '',
            last_name: r.last_name || r.lastName || r.name?.split(' ').slice(1).join(' ') || '',
            name: r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            email: r.email,
            division: r.division || '',
            roll_number: r.roll_number || r.roll || '',
            batch: r.batch || '',
            semester: r.semester ? parseInt(r.semester, 10) : 1,
            department: r.department || '',
          }));
        } else {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(fileBuffer);
          const worksheet = workbook.worksheets[0];
          const headers = [];

          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
              row.eachCell((cell, colNumber) => {
                headers[colNumber] = cell.value?.toString().trim().toLowerCase();
              });
            } else {
              const rowData = {};
              row.eachCell((cell, colNumber) => {
                const header = headers[colNumber];
                if (header) rowData[header] = cell.value?.toString().trim();
              });

              if (rowData.email) {
                parsedUsers.push({
                  first_name: rowData.first_name || rowData.firstname || rowData.name?.split(' ')[0] || '',
                  last_name: rowData.last_name || rowData.lastname || rowData.name?.split(' ').slice(1).join(' ') || '',
                  name: rowData.name || `${rowData.first_name || ''} ${rowData.last_name || ''}`.trim(),
                  email: rowData.email,
                  division: rowData.division || '',
                  roll_number: rowData.roll_number || rowData.roll || '',
                  batch: rowData.batch || '',
                  semester: rowData.semester ? parseInt(rowData.semester, 10) : 1,
                  department: rowData.department || '',
                });
              }
            }
          });
        }
      } catch {
        return reply.status(400).send({ error: 'Invalid spreadsheet file' });
      }

      const result = await UsersService.bulkUploadUsers(request.actor, parsedUsers, role);
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Bulk upload error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /admin/password — admin password change
  fastify.post('/admin/password', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const { currentPassword, newPassword } = body;
      const result = await UsersService.changePassword(request.actor, { currentPassword, newPassword });
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Password change error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /users — admin list users with filters and keyset pagination
  fastify.get('/users', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const { role, search, status, division, cursor, limit } = request.query || {};
      const usersList = await UsersService.listUsers({
        role,
        search,
        status,
        division,
        cursor: cursor || null,
        limit: limit || 100,
      });
      const pageSize = Number(limit || 100);
      const nextCursor = usersList.length === pageSize ? String(usersList.at(-1).id) : '';
      reply.header('X-Next-Cursor', nextCursor);
      return reply.send(usersList);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Fetch users error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /users — admin create single user
  fastify.post('/users', { onRequest: requireAdmin }, async (request, reply) => {
    const timing = requestTiming();
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await UsersService.createUser(request.actor, body, { onTiming: timing.record });
      reply.header('Server-Timing', timing.header());
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Create user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /users — admin update user
  fastify.put('/users', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await UsersService.updateUser(request.actor, body);
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Update user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /users — admin delete user by query param id
  fastify.delete('/users', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const id = request.query?.id;
      const result = await UsersService.deleteUser(request.actor, id);
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Delete user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /users/:id — admin update user by route param id
  fastify.put('/users/:id', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const body = request.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(400).send({ error: 'Expected a JSON object' });
      }
      const result = await UsersService.mutate(request.actor, request.params.id, 'update', body);
      return reply.send({ success: true, ...result });
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('User update error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /users/:id — admin deactivate user by route param id
  fastify.delete('/users/:id', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const result = await UsersService.mutate(request.actor, request.params.id, 'deactivate');
      return reply.send({ success: true, ...result });
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('User deactivation error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /users/bulk — admin streaming user batch creation
  fastify.post('/users/bulk', { onRequest: requireAdmin }, async (request, reply) => {
    try {
      const { role, fileBuffer, fileName, fileSize, truncated } = await readMultipart(request);

      if (!fileBuffer || !['student', 'faculty'].includes(role)) {
        return reply.status(400).send({ error: 'File and role are required' });
      }

      if (truncated || fileSize > 5 * 1024 * 1024 || fileBuffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({ error: 'Maximum upload size is 5 MB' });
      }

      const fileExt = (fileName || '').split('.').pop().toLowerCase();
      if (!['csv', 'xlsx'].includes(fileExt)) {
        return reply.status(400).send({ error: 'Upload CSV or XLSX only' });
      }

      const workbook = new ExcelJS.Workbook();
      try {
        if (fileExt === 'csv') {
          await workbook.csv.read(Readable.from(fileBuffer));
        } else {
          await workbook.xlsx.load(fileBuffer);
        }
      } catch {
        return reply.status(400).send({ error: 'Invalid spreadsheet file' });
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return reply.status(400).send({ error: 'No worksheet found in file' });
      }

      const headers = [];
      const records = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, column) => {
            headers[column - 1] = String(cell.value || '').trim();
          });
        } else {
          const obj = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber - 1] || `col${colNumber}`;
            obj[header] = cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
          });
          records.push(obj);
        }
      });

      if (records.length === 0) {
        return reply.status(400).send({ error: 'No data found in file' });
      }

      if (records.length > 500) {
        return reply.status(400).send({ error: 'Maximum 500 users per upload' });
      }

      const result = await UsersService.bulkCreateUsers(request.actor, records, role);
      return reply.send(result);
    } catch (error) {
      if (error.status) {
        return reply.status(error.status).send({ error: error.message });
      }
      console.error('Bulk user error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Method Not Allowed (405) handling preserving exact Next contract
  for (const [url, allowed] of [
    ['/admin/bulk-upload', ['POST']],
    ['/admin/password', ['POST']],
    ['/users', ['DELETE', 'GET', 'HEAD', 'POST', 'PUT']],
    ['/users/:id', ['DELETE', 'PUT']],
    ['/users/bulk', ['POST']],
  ]) {
    const allowHeader = [...new Set([...allowed, 'OPTIONS'])].sort().join(', ');
    fastify.route({
      method: 'OPTIONS',
      url,
      onRequest: async (request, reply) => reply.header('Allow', allowHeader).code(204).send(),
      handler: async () => {},
    });
    fastify.route({
      method: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'].filter((method) => !allowed.includes(method)),
      url,
      onRequest: async (request, reply) => reply.header('Allow', allowHeader).code(405).send({
        statusCode: 405,
        error: 'Method Not Allowed',
        message: `Method ${request.method} not allowed`,
      }),
      handler: async () => {},
    });
  }
}
