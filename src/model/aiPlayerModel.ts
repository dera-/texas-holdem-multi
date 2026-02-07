import { ActionModel, TexasHoldemAction } from "./actionModel";
import { PlayerModel, PlayerModelParameterObject } from "./playerModel"

export type AiType = "call" | "min-raise" | "random"

export interface AiPlayerModelParameterObject extends PlayerModelParameterObject {
	aiType: AiType;
	random?: g.RandomGenerator;
}

export class AiPlayerModel extends PlayerModel {
	private aiType: AiType;
	private random: g.RandomGenerator;
	constructor(param: AiPlayerModelParameterObject) {
		super(param);
		this.aiType = param.aiType;
		this.random = param.random || g.game.random;
	}

	decideAction(callValue: number, minimumRaiseValue: number): void {
		switch(this.aiType) {
			case "call":
				this.setAction("CALL", callValue);
				break;
			case "min-raise":
				this.setAction("RAISE", minimumRaiseValue);
				break;
			case "random":
				const action = this.getRandomAction(callValue, minimumRaiseValue);
				this.setAction(action.name, action.value);
				break;
		}
	}

	private getRandomAction(callValue: number, minimumRaiseValue: number): ActionModel {
		// 最小RAISEかCALLかFOLD
		const actions: TexasHoldemAction[] = ["RAISE", "CALL", "FOLD"];
		const randomValue = this.random.generate();
		const rate = 1 / actions.length;
		let selected: TexasHoldemAction = "FOLD";
		for (let i = 0; i < actions.length; i++) {
			if (i * rate <= randomValue && randomValue < (i + 1) * rate) {
				selected = actions[i];
				break;
			}
		}
		switch(selected) {
			case "RAISE":
				return { name: "RAISE", value: minimumRaiseValue };
			case "CALL":
				return { name: "CALL", value: callValue };
			default:
				return callValue === 0 ? { name: "CHECK", value: 0 } : { name: "FOLD", value: 0 };
		}
	}
}
