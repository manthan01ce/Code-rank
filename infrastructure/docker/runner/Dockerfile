FROM alpine:3.19

# Install base shell, compilers, and runtimes:
# - bash & coreutils (for reliable scripting & base64 piping)
# - gcc, g++, make, libc-dev (for C and C++)
# - python3 (for Python)
# - openjdk17 (contains javac compiler and java runtime)
# - nodejs (for JavaScript)
RUN apk add --no-cache \
    bash \
    coreutils \
    time \
    gcc \
    g++ \
    make \
    libc-dev \
    python3 \
    openjdk17 \
    nodejs

RUN ln -sf /usr/bin/python3 /usr/local/bin/python

WORKDIR /app

# Code is executed with a non-privileged UID. Docker Compose supplies writable
# tmpfs mounts for /app and /tmp; the image root filesystem remains read-only.
RUN addgroup -S -g 1000 sandbox && adduser -S -D -u 1000 -G sandbox sandbox
USER sandbox

# Sandbox.js supplies a bounded lifetime for each job container.
CMD ["sleep", "30"]
