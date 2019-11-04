import * as express from 'express';
import { inject } from 'inversify';
import { controller, httpGet } from 'inversify-express-utils';
import IFlightService from '../services/IFlightService';
import serviceTypes from '../services/types';
import IFlightListReq from './model/IFlightListReq';
import BaseController from '../../../../common/controller/BaseController';

@controller('/service')
export default class FlightController extends BaseController {
    @inject(serviceTypes.IFlightService)
    private _flightService: IFlightService;

    @httpGet("/flight/list")
    listFlights(request: express.Request) {
        this._logService.info('--- HEADERS --- ');
        this._logService.info({
            endpoint: "/flight/list",
            headers: request.headers,
            query: request.query
        })

        const req: IFlightListReq = request.query || {};
        // merging win2k to our request body
        req.win2k = request.header('win2k');

        console.log('--- controller register req ---', req);

        var response = this._flightService.getFlightList(req);

        return response;
    }

    @httpGet("/flight/details/:flightId")
    getById(request: express.Request, response: express.Response) {
        const params = this.params(request);
        const { flightId, entry, terminal, station } = params;
        this._logService.info({
            name: 'FlightController',
            params: params
        });
        return this.returnValue(() => {
            return this._flightService.getById(flightId, { entry: entry, terminal: terminal, station: station });
        }, response);
    }
}