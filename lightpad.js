'use strict'

let Rx = require('rxjs/Rx');
let request = require('request-promise-native');
let net = require('net');
var crypto = require('crypto');
var https = require('https');

module.exports = class PlumLightpad {

    constructor(cloudData, localData) {
        // copy all properties from cloudData and localData to this instance
        Object.assign(Object.assign(this, cloudData), localData);

        let events = new Rx.Subject();
        this.events = events.distinctUntilChanged(null, (e) => JSON.stringify(e)).asObservable();

        let socket = net.createConnection(localData.eventPort, localData.address, () => {

            // Turn the data events into an Observable sequence
            let connections = Rx.Observable.fromEvent(socket, 'data');

            connections.subscribe((data) => {
                let messages = data.toString('UTF-8').split('.\n').filter(String);
                messages.forEach((message) => {
                    try {
                        events.next(JSON.parse(message));
                    } catch (err) {
                        console.error(err);
                    }
                });
            });
        });
    }

    getLevel() {
        return this.getMetrics();
    }

    getMetrics() {
        return this.post('/v2/getLogicalLoadMetrics', { 'llid': this.llid }).then((response) => {
            try {
                return JSON.parse(response);
            } catch (err) {
                console.warn(err);
                return response;
            }
        });
    }

    setLevel(level) {
        return this.post('/v2/setLogicalLoadLevel', { llid: this.llid, level: Math.round(level) });
    }

    post(url, data) {
        let token = crypto.createHash('sha256').update(this.houseAccessToken).digest('hex');

        let lightpad = request.defaults({
            headers: {
                'User-Agent': 'Plum/2.3.0 (iPhone; iOS 9.2.1; Scale/2.00)',
                'X-Plum-House-Access-Token': token,
                'Content-Type': 'application/json'
            }
        });
        
        return lightpad.post({
            url: `https://${this.address}:${this.controlPort}${url}`,
            body: JSON.stringify(data),
            rejectUnauthorized: false
        });
    }
}
