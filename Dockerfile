FROM amazon/aws-lambda-nodejs:14
COPY index.js templates/notification-template.js message-builder-utility.js package*.json ./
RUN npm install
CMD [ "index.handler" ]
