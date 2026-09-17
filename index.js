require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Import Routes
const indexRoute = require('./routes/indexRoute');
const whatsappRoute = require('./routes/whatsappRoute');

// Use Routes
app.use('/', indexRoute);
app.use('/webhook/whatsapp', whatsappRoute);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
