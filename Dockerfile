# Use the official Rust image as a parent image
FROM rust:1.89 AS builder

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the Cargo.toml and Cargo.lock files
COPY Cargo.toml Cargo.lock ./

# Create a dummy main.rs to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (this will be cached)
RUN cargo build --release
RUN rm src/*.rs

# Copy the source code
COPY src ./src

# Build the application
RUN cargo build --release

# Use a smaller base image for the final image
FROM debian:bookworm-slim

# Install necessary runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ENV MALLOC_CONF=dirty_decay_ms:0,muzzy_decay_ms:0

# Set the working directory
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /usr/src/app/target/release/test-timer .

# Copy the static folder
COPY static ./static

# Expose the port the app runs on
EXPOSE 8000

# Run the binary
CMD ["./test-timer"]