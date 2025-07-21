# Use Node.js LTS image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript project
RUN npm run build

# Optional: remove dev dependencies to reduce image size
RUN npm prune --production

# Create non-root user
RUN useradd --user-group --create-home --shell /bin/false appuser
USER appuser

# Expose port expected by Cloud Run
EXPOSE 4000

# Use start script (with --enable-source-maps)
CMD [ "npm", "start" ]
