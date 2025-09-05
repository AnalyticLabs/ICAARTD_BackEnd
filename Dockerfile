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
EXPOSE 5000

# Start the server
CMD ["node", "src/index.js"]
