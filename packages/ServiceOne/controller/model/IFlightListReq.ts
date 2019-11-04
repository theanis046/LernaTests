export default interface IFlightListReq {
    entry: string;
    terminal: string;
    station: string;
    win2k: string;
    destination?: string;
    flightStatus?: number;
    departureFromDate?: string;
    departureToDate?: string;
}