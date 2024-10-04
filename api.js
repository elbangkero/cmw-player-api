


getPlayerInfo = async (_req, _res) => {

    console.log(_req.query);
    _res.status(200).json({ 'PlayerToken': _req.query });
}

module.exports = function (app) {

    app.get('/player-info', getPlayerInfo);

};