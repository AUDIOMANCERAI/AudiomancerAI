--- STAGE 1: Build Stage ---

Use a lightweight Node image for building dependencies

FROM node:lts-slim AS builder

Set the working directory for all subsequent commands

WORKDIR /app

Copy package.json and package-lock.json separately

This layer is cached unless dependencies change, speeding up subsequent builds.

COPY package*.json ./

Install application dependencies

RUN npm install

Copy the rest of the application source code

COPY . .

If you have a build step (like React, Angular, or TypeScript compilation),

uncomment and adjust the following line:

RUN npm run build

--- STAGE 2: Production Stage ---

Use a super-minimalist base image to run the final application

This significantly reduces the final image size and attack surface.

FROM node:lts-slim AS production

Set the working directory

WORKDIR /app

Copy only the necessary files from the builder stage:

1. node_modules (which were already installed)

2. package.json (needed for npm start)

3. The built or source code (depending on whether you use a build step)

If using a build step (e.g., compiled code is in a 'dist' or 'build' folder):

COPY --from=builder /app/dist ./

COPY --from=builder /app/node_modules ./node_modules

If running source code directly (like a simple Express API):

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/ ./

Define the port the application listens on (e.g., for an Express server)

EXPOSE 8080

Define the command to run the application

Use 'npm start' if your package.json has a start script

CMD ["npm", "start"]
