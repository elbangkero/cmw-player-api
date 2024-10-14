
const { local_connection } = require('./database');
const https = require('https');
const interval = 300;
const axios = require('axios');

getPlayerInfo = async (_req, _res) => {
    if (_req.query.token) {
        const playerToken = _req.query.token;
        const playerResult = await setPlayerInfo(playerToken);
        const playerInfo = (playerResult.rows.length === undefined || playerResult.rows.length == 0) ? false : playerResult.rows[0];


        await requestVitruvian(playerToken)
            .then(async function (response) {
                const query = `
                        INSERT INTO cmw_playerinfo (playertoken, info, profile, tags, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, NOW(), NOW())
                        ON CONFLICT (playertoken)
                        DO UPDATE SET 
                            info = EXCLUDED.info,
                            profile = EXCLUDED.profile,
                            tags = EXCLUDED.tags,
                            updated_at = NOW();  -- Update the 'updated_at' field to the current time on conflict
                    `;
                const values = [response.playertoken, response.info, response.profile, response.tags];

                local_connection.query(query, values, (err, res) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('Upserted Successfully: ', response.playertoken);
                        return _res.status(200).json({ 'data': response });
                    }
                });
            }).catch(async function (err) {
                console.log('Player doess not exist on virtuvian');
                if (playerInfo) {
                    console.log('....Getting Player info from Database');
                    return _res.status(200).json({ 'data': playerInfo });
                } else {
                    return _res.status(200).json({ 'data': 'Player does not exist' });
                }
            });
    } else {
        return _res.status(200).json({ 'Error': 'Token is required' });
    }

}

async function setPlayerInfo(player_token) {
    return res = await local_connection.query(`SELECT playertoken, info, profile, tags FROM cmw_playerinfo WHERE playertoken = '${player_token}' LIMIT 1`);
}

async function requestVitruvian(item, retries = 10) {
    const playerToken = item;
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

module.exports = function (app) {

    app.get('/player-info', getPlayerInfo);

};