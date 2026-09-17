require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Import Routes
const indexRoute = require('./routes/indexRoute');
const whatsappRoute = require('./routes/whatsappRoute');
const deliveryRoutes = require('./routes/deliveryRoutes');

// Use Routes
app.use('/', indexRoute);
app.use('/webhook/whatsapp', whatsappRoute);
app.use('/api/delivery', deliveryRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
