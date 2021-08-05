FROM amazon/aws-lambda-nodejs:14
COPY index.js message-builder-utility.js package*.json ./
COPY /templates/notification-template.js ./templates/
RUN npm install --production
CMD [ "index.handler" ]
