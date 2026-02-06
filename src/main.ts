import { GameMainParameterObject } from "./parameterObject";
import { TitleScene } from "./scene/titleScene";

export function main(param: GameMainParameterObject): void {
	g.game.pushScene(new TitleScene({
		game: g.game,
		isCpuMode: param.isAtsumaru,
		assetIds: ["chip"]
	}));
}
