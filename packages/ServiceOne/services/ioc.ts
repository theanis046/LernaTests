import { Container } from "inversify";
import IFlightService from "./IFlightService";
import flightServiceTypes from "./types";
import FlightService from "./implementation/FlightService";

export function configureFlightServices(container: Container) {
    container.bind<IFlightService>(flightServiceTypes.IFlightService).to(FlightService).inSingletonScope();
    return container;
}