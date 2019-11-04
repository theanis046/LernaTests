import mapField from '../../../../../annotation/mapField';
import AlertDto from "./AlertDto";
import PassengerDto from "./PassengerDto";

@mapField('id')
@mapField('timestamp')
@mapField('carrierCode')
@mapField('flightNo')
@mapField('gate')
@mapField('boardingTime')
@mapField('departureLoc')
@mapField('arrivalLoc')
@mapField('STD')
@mapField('departureDate', 'STD')
@mapField('ETD')
@mapField('delayInMinute', 'delayInMinute')
@mapField('isDelayed', 'isDelayed', false)
@mapField('isCancelled', 'isCancelled', false)
@mapField('isBoarding', 'isBoarding')
@mapField('isReRouted', 'isReRouted')
@mapField('isRescheduled', 'isRescheduled')
@mapField('isGateChanged', 'isGateChanged', false)
@mapField('passengers', 'passengers', [])
export default class FlightDto {
    id: string;
    timestamp: string;
    STD: string;
    ETD?: string;
    carrierCode: string;
    flightNo: string;
    gate?: string;
    departureDate?: string;
    boardingTime?: string;
    departureLoc: string;
    arrivalLoc: string;
    numberOfPax: number;
    isVip: boolean;
    alert: AlertDto;
    isDelayed: boolean;
    isCancelled: boolean;
    isGateChanged: boolean;
    passengers: PassengerDto[];
}