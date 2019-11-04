import mapField from '../../../../../annotation/mapField';

@mapField('id')
@mapField('firstName')
@mapField('surname')
@mapField('highestLounge')
@mapField('isVip', 'isVip', false)
@mapField('salutation')
// @mapField('entry')
// @mapField('terminal')
// @mapField('station')
export default class PassengerDto {
    id: string;
    firstName: string;
    surname: string;
    highestLounge: string;
    isVip: boolean;
    // salutation: string;
    // entry: string;
    // terminal: string;
    // station: string;
}