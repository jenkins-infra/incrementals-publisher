ARG NODEJS_VERSION=24.18.1
FROM node:${NODEJS_VERSION}

ENV NODE_ENV production
ENV PORT 3000
EXPOSE 3000

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm ci

# Bundle app source
COPY . .

CMD [ "node", "index.js" ]
