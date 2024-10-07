const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const players = [];
const interval = 300;
const https = require('https');
const { local_connection } = require('./database');


fs.createReadStream('/usr/local/var/www/cmw-playerinfo-api/Playersinfo.csv')
    .pipe(csv())
    .on('data', async function (data) {
        const sanitizedData = Object.fromEntries(
            Object.entries(data).map(([key, value]) => [
                key.replace(/[\s']/g, ''),
                value === '' ? '' : value
            ])
        );
        players.push(JSON.stringify({
            'player_token': sanitizedData.player_token,
        }));
    })
    .on('end', () => {

        let dynamic_counter = {};
        let counter_name = 'counter';
        dynamic_counter[counter_name] = { fails: 0, success: 0 };
        players.forEach((item, index) => {
            setTimeout(async () => {

                await requestVitruvian(item)
                    .then(async function (response) {
                        const query = `INSERT INTO cmw_playerinfo(playertoken,info,profile,tags) VALUES ($1,$2,$3,$4)`;
                        const values = [response.playertoken, response.info, response.profile, response.tags];
                        local_connection.query(query, values, (err, res) => {
                            if (err) {
                                console.log(err);
                                dynamic_counter.counter.fails++;
                            } else {
                                dynamic_counter.counter.success++;
                                console.log('Inserted Successfully : ', response.playertoken);
                            }
                        });
                    }).catch(async function (err) {
                        dynamic_counter.counter.fails++;
                        console.log(err);
                    }).finally(async function () {
                        if (players.length == index + 1) {
                            setTimeout(async () => {
                                console.log(`Result: ${dynamic_counter.counter.success} Success, ${dynamic_counter.counter.fails} Failed`)
                            }, index * interval);
                        }
                    })
            }, index * interval);
        });
    })
    .on('error', (err) => {
        console.log(err);
    });


async function requestVitruvian(item, retries = 10) {
    const parsedData = JSON.parse(item);
    const playerToken = parsedData.player_token;


    return new Promise(async (resolve, reject) => {

        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://afun-playerinfo-ap-prod.vitruviandata.com/player?token=${playerToken}`,
            headers: {
                'Authorization': 'Basic bmltYnVzOndeN3FCUCpOJlRaZQ=='
            },
            timeout: 60000,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            })
        };

        const requestVitruvian = async (attempt) => {
            setTimeout(async () => {
                try {
                    const response = await axios(config);
                    if (response.data.results.length === 0) {
                        reject('Invalid {PlayerToken}');
                    } else {
                        resolve({
                            'playertoken': playerToken,
                            'info': response.data.results[0].info,
                            'profile': response.data.results[0].profile,
                            'tags': response.data.results[0].tags
                        });
                    }
                } catch (error) {
                    if (error.code === 'ECONNABORTED') {
                        reject('Request Timeout From Vitruvian');
                    }
                    else if (error.code === 'ERR_BAD_RESPONSE') {

                        if (attempt < retries) {
                            setTimeout(async function () {
                                console.log(`Retrying... Attempt on Token : ${playerToken} Attempt : ${attempt + 1}`);
                                await requestVitruvian(attempt + 1);
                            }, attempt * 10000);
                        } else {
                            const errorResponse = {
                                data: {
                                    success: false,
                                    error: 'Vitruvian API Service Unavailable Exceeded 1 min Request',
                                    errordata: `${retries} attempts for this request have been exhausted`
                                }
                            };
                            reject(errorResponse);
                        }
                    } else {
                        reject(error);
                    }
                }
            }, interval);
        };
        await requestVitruvian(0);
    });
}