FROM python:3.11-slim

WORKDIR /app

# Non-root user for security
RUN useradd -m -u 1000 sandboxuser && \
    mkdir -p /app && \
    chown -R sandboxuser:sandboxuser /app

USER sandboxuser

CMD ["tail", "-f", "/dev/null"]
