const express = require("express");
const app = express();
const dotenv = require('dotenv'); 
dotenv.config();
const cors = require('cors');
app.use(cors());
app.options('*', cors()); 
require('./api')(app);
app.listen(`${process.env.PORT}`, () => {
  console.log('API listening on port : ' + `${process.env.PORT}`);
});

app.get('/', (request, response) => {
  response.json({ info: 'Communication Middleware API - Player Info' })
});
  