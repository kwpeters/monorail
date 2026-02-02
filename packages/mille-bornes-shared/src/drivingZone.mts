import { z } from "zod";


////////////////////////////////////////////////////////////////////////////////
// RollState
////////////////////////////////////////////////////////////////////////////////
export const schemaRollState = z.enum(["Stopped", "Roll"]);
export type RollState = z.infer<typeof schemaRollState>;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const RollState = schemaRollState.enum;
// Enumerating values of RollState:
//     for (const cur of Object.values(RollState)) {}
//     for (const cur of schemaRollState.options) {}


export interface IActiveSafetyCardStatus {
    isCoupFourre: boolean;
}



export const schemaDrivingZone = z.strictObject({

    rollState: schemaRollState,

});





// export class DrivingZone {
//
//     // Distance pile (need to know specific cards b/c only 2 200s are allowed)
//     // Distance travelled.
//
//     // The current roll status.
//     private _rollStatus: RollStatus = RollStatus.stopped;
//
//     // Whether a speed limit is active.
//     private _speedLimitActive: boolean = false;
//
//     // Whether a calamity is active (accident, out of gas, flat tire)
//     private _calamityActive: Option<CalamityHazardCard> = NoneOption.get();
//
//     private _drivingAceActive: Option<IActiveSafetyCardStatus> = NoneOption.get();
//     private _extraTankActive: Option<IActiveSafetyCardStatus> = NoneOption.get();
//     private _punctureProofActive: Option<IActiveSafetyCardStatus> = NoneOption.get();
//     private _rightOfWayActive: Option<IActiveSafetyCardStatus> = NoneOption.get();
//
//     public get drivingAceActive(): Option<IActiveSafetyCardStatus> {
//         return this._drivingAceActive;
//     }
//
//     public get extraTankActive(): Option<IActiveSafetyCardStatus> {
//         return this._extraTankActive;
//     }
//
//     public get punctureProofActive(): Option<IActiveSafetyCardStatus> {
//         return this._punctureProofActive;
//     }
//
//     public get rightOfWayActive(): Option<IActiveSafetyCardStatus> {
//         return this._rightOfWayActive;
//     }
//
// }
