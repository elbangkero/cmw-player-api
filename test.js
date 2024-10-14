const axios = require('axios');

let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'http://172.31.11.15:2041/player-info?playertoken=6969696',
    headers: {}
};

axios.request(config)
    .then((response) => {
        console.log(JSON.stringify(response.data));
    })
    .catch((error) => {
        console.log(error);
    });
