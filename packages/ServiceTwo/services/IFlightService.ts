import IFlightListReq from "../controller/model/IFlightListReq";
import FlightListResponseDto from './dto/FlightListResponseDto';
import FlightDto from './dto/FlightDto';

export default interface IFlightService {
    getById(id: string, criteria: {entry: string, terminal: string, station: string}): Promise<FlightDto>;
    getFlightList(req: IFlightListReq): Promise<FlightListResponseDto>;
}