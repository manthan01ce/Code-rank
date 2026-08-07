import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    let userResult;
    try {
       userResult = await sql`SELECT * FROM users WHERE email = ${email}`;
    } catch (e) {
       console.error('DB Error:', e);
       return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Check fallback for admin from .env if not found in DB
    let dbUser;
    if (userResult.length === 0) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (email === adminEmail && password === adminPassword) {
        dbUser = {
          id: 0,
          name: 'Super Admin',
          email: adminEmail,
          password: adminPassword, // This is raw, but comparePassword handles both hash and raw? No.
          role: 'admin',
          status: 'active'
        };
      } else {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    } else {
      dbUser = userResult[0];
    }

    const dbUserPassword = dbUser.password;
    let passwordMatch = false;
    
    // If it's the fallback admin, we compare timing-safely by hashing first to prevent timing attacks
    if (dbUser.id === 0) {
      const userHash = crypto.createHash('sha256').update(password).digest();
      const adminHash = crypto.createHash('sha256').update(dbUserPassword).digest();
      passwordMatch = crypto.timingSafeEqual(userHash, adminHash);
    } else {
      try {
         passwordMatch = await comparePassword(password, dbUserPassword);
      } catch (e) {
         console.error('Bcrypt Error:', e);
         return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
      }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (dbUser.status !== 'active') {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }

    let token;
    try {
       token = generateToken({ id: dbUser.id, email: dbUser.email, role: dbUser.role, name: dbUser.name });
    } catch (e) {
       console.error('JWT Error:', e);
       return NextResponse.json({ error: 'Token generation failed' }, { status: 500 });
    }

    if (dbUser.id !== 0) {
      try {
         await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${dbUser.id}, 'LOGIN', ${'User logged in'})`;
      } catch (e) {
         console.error('Log Error:', e);
      }
    }

    return NextResponse.json({
      token,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role
      }
    });
  } catch (error) {
    console.error('Unhandled Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

