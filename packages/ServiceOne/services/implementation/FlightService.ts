import { injectable, inject } from "inversify";
import * as _ from 'underscore';
import BaseService from "../../../../../common/services/implementation/BaseService";
import IFlightService from "../../services/IFlightService";
import IFlightListReq from "../../controller/model/IFlightListReq";
import IFlightRepository from "../../../../../common/repositories/IFlightRepository";
import * as moment from 'moment';
import IRegistrationService from "../../../../../common/services/IRegistrationService";
import FlightDto from "../../services/dto/FlightDto";
import { FlightModel } from "../../../../../common/repositories/model/FlightModel";
import { RegistrationModel } from "../../../../../common/repositories/model/RegistrationModel";
import commonTypes from '../../../../../common/services/types';
import commonRepoTypes from '../../../../../common/repositories/types';
import FlightListResponseDto from "../dto/FlightListResponseDto";
import AlertDto from "../dto/AlertDto";
import IDateService from "../../../../../common/services/IDateService";
import ILambdaServiceProxy from "../../../../../common/services/ILambdaServiceProxy";
import ServiceName from "../../../../../common/enum/ServiceName";
import ServiceAddress from "../../../../../common/enum/ServiceAddress";
import PassengerDto from "../dto/PassengerDto";
import flightListDto from "../../services/dto/flightListDto";
import datesRangeDto from "../../services/dto/datesRangeDto";


@injectable()
export default class FlightService extends BaseService<FlightDto> implements IFlightService {

    @inject(commonRepoTypes.IFlightRepository)
    private _flightRepository: IFlightRepository;

    @inject(commonTypes.IRegistrationService)
    private _registrationService: IRegistrationService;

    @inject(commonTypes.IDateService)
    private readonly _dateService: IDateService;

    @inject(commonTypes.ILambdaServiceProxy)
    private readonly _lambdaServiceProxy: ILambdaServiceProxy;

    private dateFormat = "YYYY-MM-DD";
    private maxConstDate = new Date("1900-01-01T00:00:00.000Z")
    private minConstDate = new Date("2100-12-31T00:00:00.000Z")

    protected getDtoClass(): Function {
        return FlightDto;
    }

    async getById(id: string, criteria: { entry: string, terminal: string, station: string }): Promise<FlightDto> {
        const model = await this._flightRepository.getById(id);
        const flightDto = this.toDto(model);
        this._logService.info({
            name: 'FlightService',
            flightModel: model,
            flightDto: flightDto
        });
        let ids = [];
        if (model) {
            if (model.mainPaxIds) {
                ids = ids.concat(model.mainPaxIds);
            }
            if (model.guestIds) {
                ids = ids.concat(model.guestIds);
            }
            ids = _.uniq(ids);
            flightDto.passengers = await this._getPassengersByIds(ids, criteria);
        }
        return flightDto;
    }

    async getFlightList(req: IFlightListReq) {
        let startTime = moment();
        let endTime = startTime.clone().add(48, "hours");

        if (this.isAdvancedSearch(req)
            && req.departureFromDate
            && req.departureToDate) {
            startTime = moment.utc(req.departureFromDate);
            endTime = moment.utc(req.departureToDate);
        }

        this._logService.info({
            method: 'getFlightList: Time Values',
            endTime: endTime.toISOString(),
            startTime: startTime.toISOString()
        });

        let flightList: flightListDto = new flightListDto();
        flightList.range = new datesRangeDto()
        flightList.flights = [];

        // Add 1 extra day before current time to cater for flight delay case BECAUSE
        // 1. the query is based timestamp which derived from STD
        // 2. the returned flight list should based on ETD if ETD exist
        // 3. for delayed flight it's possible that the ETD is within the range of flight list to be returned
        //    while the timestamp is out of range
        const extraStartTime = startTime.clone().subtract(24, "hours");
        const targetDates = this.getAllDaysWithRange(extraStartTime.toISOString(), endTime.toISOString());

        this._logService.info("------ target dates ------");
        this._logService.info(targetDates);

        if (targetDates && targetDates.length > 0) {
            var rawFlightList = await this._flightRepository.getFlightsByTimeRange(targetDates, req.station);

            this._logService.info({
                method: 'getFlightList',
                flightList: rawFlightList
            });


            let advancedFilter = this.filterFlightsByDestination(req, rawFlightList);

            if (this.isAdvancedSearch(req)) {
                if (req.flightStatus) {
                    advancedFilter = this.getFlightsByStatus(req, advancedFilter);
                }

                this._logService.info({
                    method: 'Advancedfilter',
                    flightList: advancedFilter
                });
                rawFlightList = advancedFilter;
            }

            var passengerList = await this._registrationService.getRegistrationList(targetDates);

            this._logService.info({
                method: 'getPassengerList',
                passengerList: JSON.stringify(passengerList.length),
                passengerListObject: passengerList.length
            });

            if (rawFlightList && passengerList
                && rawFlightList.length > 0 && passengerList.length > 0) {
                rawFlightList.forEach(flight => {
                    const flightTime = moment.utc(this._utilService.getValueWithoutNullOrEmpty(flight.ETD) != " " ? flight.ETD : flight.STD);

                    this._logService.info({
                        method: 'Flight Iterations',
                        flightTime: flightTime.toISOString(),
                        endTime: endTime.toISOString(),
                        startTime: startTime.toISOString()
                    });

                    //The flight need to be within the range and a departure flight
                    if (flightTime.isSameOrBefore(endTime) && flightTime.isSameOrAfter(startTime) && flight.departureLoc == req.station) {
                        let passengersForTheFlight = passengerList.filter(passenger => {

                            return flight.carrierCode == passenger.passengerDetails.carrierCode
                                && flight.flightNo == passenger.flightDetails.flightNumber
                                && flight.STD == passenger.eligibility.STD
                                && req.station == passenger.location.airportCode;
                        });

                        //Entry is optional for Advanced Search, but is mandatory for Basic Listing
                        passengersForTheFlight = this.filterPassengersByEntry(req, passengersForTheFlight);
                        passengersForTheFlight = this.filterPassengersByTerminal(req, passengersForTheFlight);

                        if (passengersForTheFlight.length > 0) {
                            flightList.flights.push(this.modelToFlightRes(flight, passengersForTheFlight));
                        }

                        this._logService.info({
                            method: 'getFlightList: flightsByDate',
                            flightNumber: flight.flightNo,
                            flightsAll: flightList
                        });
                    }
                });
            }
        }

        flightList.flights.sort((flight1, flight2) =>
            this.isFlight1Later(flight1, flight2) ? 1 : -1
        );

        flightList.range = this.getDateRange(flightList);
        const flightListRes = {
            list: flightList,
        } as FlightListResponseDto;

        this._logService.info({
            method: 'getFlightList',
            flightListRes: flightList
        });

        return flightListRes;
    }

    private getAllDaysWithRange(startTime: string, endTime: string): string[] {
        const startTimeMoment = moment.utc(startTime);
        const endTimeMoment = moment.utc(endTime);
        let currentTime = startTimeMoment.clone();
        let currentTimeDate = currentTime.format(this.dateFormat);
        const endTimeDate = endTimeMoment.clone().format(this.dateFormat);
        const targetDates: string[] = [endTimeDate];

        while (currentTimeDate !== endTimeDate) {
            targetDates.push(currentTimeDate);
            currentTime = currentTime.clone().add(24, "hours");
            currentTimeDate = currentTime.format(this.dateFormat);
        }

        return targetDates;
    }

    private isFlight1Later(flight1: FlightDto, flight2: FlightDto): boolean {
        return moment.utc(flight1.ETD ? flight1.ETD : flight1.STD).isAfter(moment.utc(flight2.ETD ? flight2.ETD : flight2.STD));
    }

    private filterPassengersByEntry(req: IFlightListReq, passengersForTheFlight: RegistrationModel[]): RegistrationModel[] {
        if (this.isAdvancedSearch(req)) {
            if (req.entry) {
                passengersForTheFlight = passengersForTheFlight.filter(passenger => {
                    return req.entry == passenger.location.entry
                });
            }
        }
        else {
            passengersForTheFlight = passengersForTheFlight.filter(passenger => {
                return req.entry == passenger.location.entry
            });
        }
        return passengersForTheFlight;
    }

    private filterPassengersByTerminal(req: IFlightListReq, passengersForTheFlight: RegistrationModel[]): RegistrationModel[] {
        if (req.terminal) {
            passengersForTheFlight = passengersForTheFlight.filter(passenger => {

                return req.terminal == passenger.location.terminal
            });
            return passengersForTheFlight;
        }
        else {
            return passengersForTheFlight;
        }
    }


    private filterFlightsByDestination(req: IFlightListReq, flightList: FlightModel[]): FlightModel[] {
        if (this.isAdvancedSearch(req)) {
            if (req.destination) {
                flightList = flightList.filter(flight =>
                    flight.arrivalLoc == req.destination);
            }
        }
        return flightList;
    }


    private modelToFlightRes(flightModel: FlightModel, passengerList: RegistrationModel[]): FlightDto {
        var flightDto = new FlightDto();
        let uniquePassengerIds = passengerList.map(passenger => passenger.id);
        uniquePassengerIds = _.uniq(uniquePassengerIds);

        flightDto.id = flightModel.id;
        flightDto.STD = flightModel.STD;
        flightDto.ETD = this._dateService.deriveETD(flightModel.STD, flightModel.delayInMinute);
        flightDto.flightNo = flightModel.flightNo;
        flightDto.carrierCode = flightModel.carrierCode;
        flightDto.departureLoc = flightModel.departureLoc;
        flightDto.arrivalLoc = flightModel.arrivalLoc;
        flightDto.gate = <any>flightModel.gate;
        flightDto.boardingTime = flightModel.boardingTime;
        flightDto.numberOfPax = uniquePassengerIds.length;

        const vipPassengers = passengerList.filter(passenger => {
            return passenger.passengerDetails.isVip;
        });

        flightDto.isVip = vipPassengers.length > 0;

        // just map the alerts from the DB Flight Model
        const alert = {
            isGateChanged: flightModel.isGateChanged,
            delayInMinute: flightModel.delayInMinute,
            isReRouted: flightModel.isReRouted,
            isBoarding: flightModel.isBoarding,
            isRescheduled: flightModel.isRescheduled,
            isCancelled: flightModel.isCancelled
        } as AlertDto;

        flightDto.alert = alert;

        return flightDto;
    }

    private getFlightsByStatus(req: IFlightListReq, advancedFilter: FlightModel[]): FlightModel[] {

        if (req.flightStatus) {
            if (req.flightStatus == 0) {
                advancedFilter = advancedFilter.filter(FStatus => {
                    return FStatus.delayInMinute == 0
                        && FStatus.isCancelled == false
                })
            }

            else if (req.flightStatus == 1) {
                advancedFilter = advancedFilter.filter(FStatus =>
                    FStatus.delayInMinute > 0)
            }

            else if (req.flightStatus == 2) {
                advancedFilter = advancedFilter.filter(FStatus =>
                    FStatus.isBoarding == true)
            }

            else if (req.flightStatus == 3) {
                advancedFilter = advancedFilter.filter(FStatus =>
                    FStatus.isCancelled == true)
            }
            else if (req.flightStatus == 4) {
                advancedFilter = advancedFilter.filter(FStatus =>
                    FStatus.isReRouted == true)
            }
            else if (req.flightStatus == 5) {
                advancedFilter = advancedFilter.filter(FStatus =>
                    FStatus.isRescheduled == true)
            }
        }
        return advancedFilter;
    }

    private isAdvancedSearch(req: IFlightListReq): boolean {
        if (req.flightStatus && req.departureFromDate && req.departureToDate) {
            return true;
        }
        return false;
    }

    private async _getPassengersByIds(ids: string[], criteria: any): Promise<PassengerDto[]> {
        let passengers;
        const responses = await this._lambdaServiceProxy.post({
            serviceName: ServiceName.registration,
            address: ServiceAddress.registrationServicePassengerList,
            payload: {
                passengerIds: ids
            }
        }) || [];
        this._logService.info({
            name: 'FlightService',
            httpResponse: responses
        });
        if (responses && responses.length > 0) {
            const records = _.where(responses, this._toPassengerObjectCriteria(criteria));
            passengers = records.map(passenger => {
                return this._utilService.createObjectFrom(PassengerDto, passenger);
            });
        }
        return passengers || [];
    }

    private _toPassengerObjectCriteria(criteria: any) {
        let where = {};
        if (criteria) {
            Object.keys(criteria)
                .forEach(key => {
                    const value = (criteria[key] || '').trim();
                    if (value.length > 0) {
                        where[key] = value;
                    }
                });
        }
        return where;
    }

    private getMinimumDateFromDatesList(flightsList: flightListDto): Date {
        let minDate = new Date("2100-12-31T00:00:00.000Z")

        for (let i = 0; i < flightsList.flights.length; i++) {
            let departureDate;
            let flight = flightsList.flights[i];
            if (flight.ETD && flight.ETD != " ") {
                departureDate = moment.utc(flight.ETD);
            }
            else {
                departureDate = moment.utc(flight.STD);
            }
            if (departureDate < minDate) {
                minDate = departureDate;
            }
        }
        return minDate;
    }

    private getMaximumDateFromDatesList(flightsList: flightListDto): Date {
        let maxDate = new Date("1900-01-01T00:00:00.000Z")

        for (let i = 0; i < flightsList.flights.length; i++) {
            let departureDate;
            let flight = flightsList.flights[i];
            if (flight.ETD && flight.ETD != " ") {
                departureDate = moment.utc(flight.ETD);
            }
            else {
                departureDate = moment.utc(flight.STD);
            }
            if (departureDate > maxDate) {
                maxDate = departureDate;
            }
        }
        return maxDate;
    }

    private getDateRange(flightsList: flightListDto): datesRangeDto {
        let min = this.getMinimumDateFromDatesList(flightsList);
        let max = this.getMaximumDateFromDatesList(flightsList);

        if (moment(min).isSame(moment(this.minConstDate)) && moment(max).isSame(moment(this.maxConstDate))) {
            return null;
        }

        let datesRange: datesRangeDto = new datesRangeDto();
        datesRange.maximumDate = this._dateService.toUtcFormat(max);
        datesRange.minimumDate = this._dateService.toUtcFormat(min);

        return datesRange;
    }
}