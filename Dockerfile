# Use Node.js LTS (Alpine is smaller and good for production)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose the backend port (change if needed, default 5000)
EXPOSE 8080

# Start the server via index.js
CMD ["node", "src/index.js"]
