import * as express from "express";
import { Container } from 'inversify';
import { InversifyExpressServer } from 'inversify-express-utils';
import * as bodyParser from 'body-parser';
import { configureCommonServices } from '../../../common/services/ioc';
import { configureCommonRepositories } from '../../../common/repositories/ioc';
import { configureFlightServices } from './services/ioc';
import { configureFlightRepositories } from './repositories/ioc';
import { configureRegistrationServices } from '../registration/services/ioc';
import { configureRegistrationRepositories } from '../registration/repositories/ioc';
import IErrorHandlerService from '../../../common/services/IErrorHandlerService';
import commonServiceTypes from '../../../common/services/types';
import cors from '../../../common/middleware/cors';

//list of controller
import './controller/FlightController';

let container = new Container();
configureCommonServices(container, __dirname);
configureCommonRepositories(container);
configureFlightRepositories(container);
configureFlightServices(container);
configureRegistrationServices(container);
configureRegistrationRepositories(container);

const app: express.Application = express();
app.use(cors());
let server = new InversifyExpressServer(container, app);
server.setConfig((app) => {
    app.use(bodyParser.urlencoded({
        extended: false
    }));
    app.use(bodyParser.json());
});

let errorHandlerService = container.get<IErrorHandlerService>(commonServiceTypes.IErrorHandlerService);
server.setErrorConfig(app => {
    app.use(errorHandlerService.handle.bind(errorHandlerService));
});

export default server.build();