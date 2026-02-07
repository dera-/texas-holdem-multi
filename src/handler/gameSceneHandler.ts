import { GameScene } from "../scene/gameScene";
import { RaiseActionPattern, TexasHoldemAction } from "../model/actionModel";
import { ResultScene } from "../scene/resultScene";
import { PlayerModel } from "../model/playerModel";
import { AssetIds } from "../type/assetIds";
import { AiPlayerModel } from "../model/aiPlayerModel";

const setTemporaryRaiseAction = (scene: GameScene, player: PlayerModel, value: number): void => {
	const stack = player.getTotalStack();
	if (value > stack) {
		value = stack;
	} else if (value < 0) {
		value = 0;
	}
	player.setTemporaryAction("RAISE", value);
	scene.moveBetSlider(value, stack);
	scene.changeBetLabel(value);
}

// ベット額増加イベント
export const createBetUpClickHandler = (scene: GameScene) => {
	return (e: g.PointDownEvent) => {
		const service = scene.getService();
		// 対象プレイヤー取得。一旦、IDからの検索をしてみる。見つからなければ何もしない感じで
		const player = service.getPlayerById(e.player.id);
		if (!player) {
			return;
		}
		const currentAction = player.getTemporaryAction();
		const value = currentAction === null || currentAction.value === 0 ?
			service.getMinRaiseValue() + service.getBigBlindValue() : currentAction.value + service.getBigBlindValue();
		setTemporaryRaiseAction(scene, player, value);
	};
};

// ベット額減少イベント
export const createBetDownClickHandler = (scene: GameScene) => {
	return (e: g.PointDownEvent) => {
		const service = scene.getService();
		// 対象プレイヤー取得。一旦、IDからの検索をしてみる。見つからなければ何もしない感じで
		const player = service.getPlayerById(e.player.id);
		if (!player) {
			return;
		}
		const currentAction = player.getTemporaryAction();
		const value = currentAction === null || currentAction.value - service.getBigBlindValue() <= service.getMinRaiseValue() ?
			service.getMinRaiseValue() : currentAction.value - service.getBigBlindValue();
		setTemporaryRaiseAction(scene, player, value);
	};
};

const decideBetValue = (scene: GameScene, id: string, x: number): void => {
	const rate = scene.calculateBetSliderRate(x);
	const service = scene.getService();
	// 対象プレイヤー取得。一旦、IDからの検索をしてみる。見つからなければ何もしない感じで
	const player = service.getPlayerById(id);
	if (!player) {
		return;
	}
	const stack = player.getTotalStack();
	const minimum = service.getMinRaiseValue();
	const value = Math.round(rate * (stack - minimum)) + minimum;
	setTemporaryRaiseAction(scene, player, value);
};

// ベット額決定イベント(スライダー)
export const createBetSliderMoveHandler = (scene: GameScene) => {
	return (e: g.PointMoveEvent) => {

		const globalPoint = scene.getGlobalOffsetFromSprite("bet_slider", e.prevDelta);
		decideBetValue(scene, e.player.id, globalPoint.x);
	};
};

// ベット額決定イベント(バークリック)
export const createBetBarClickHandler = (scene: GameScene) => {
	return (e: g.PointUpEvent) => {
		const globalPoint = scene.getGlobalOffsetFromSprite("bet_value_bar", e.point);
		decideBetValue(scene, e.player.id, globalPoint.x);
	};
};

// レイズ額決めるやつ
export const createRaiseButtonClickHandler = (scene: GameScene, pattern: RaiseActionPattern) => {
	return (e: g.PointUpEvent) => {
		const service = scene.getService();
		// 対象プレイヤー取得。一旦、IDからの検索をしてみる。見つからなければ何もしない感じで
		const player = service.getPlayerById(e.player.id);
		if (!player) {
			return;
		}
		let raiseValue = 0;
		switch(pattern) {
			case "THREE_BB":
				raiseValue = 3 * service.getBigBlindValue();
				break;
			case "HALF_POT":
				raiseValue = service.getPotValue() / 2;
				break;
			case "POT":
				raiseValue = service.getPotValue();
				break;
			case "ALLIN":
				raiseValue = player.getTotalStack();
				break;
			default:
				return;
		}
		setTemporaryRaiseAction(scene, player, raiseValue);
	};
};

// アクション決定
export const createActionButtonClickHandler = (scene: GameScene, action: TexasHoldemAction) => {
	return (e: g.PointUpEvent) => {
		scene.initializePokerController();
		const service = scene.getService();
		const player = service.getPlayerById(e.player.id);
		if (!player || player.isTimeUp()) {
			return;
		}
		switch(action) {
			case "ALLIN":
				player.setTemporaryAction("ALLIN", player.getTotalStack());
				break;
			case "CALL":
				player.setTemporaryAction("CALL", service.getCurrentCallValue());
				break;
			case "CHECK":
				player.setTemporaryAction("CHECK", 0);
				break;
			case "FOLD":
				player.setTemporaryAction("FOLD", 0);
				break;
			case "RAISE":
				if (player.getTemporaryAction() === null) {
					player.setTemporaryAction("RAISE", service.getMinRaiseValue());
				}
				break;
		}
		const playerAction = player.getTemporaryAction();
		player.clearTemporaryAction(); // ここでTemporaryActionを初期化しておかないと最小のRERERAISEを使用としたときに前のレイズ額のままレイズしようとするエラーが発生してしまう
		g.game.raiseEvent(new g.MessageEvent({ message: "PLAYER_ACTION", playerId: e.player.id, playerAction }));
	};
};

export const createMessageHandler = (scene: GameScene) => {
	return (ev: g.MessageEvent) => {
		if (!ev.data || !ev.data.message) {
			return;
		}
		if (ev.data.message === "PLAYER_ACTION") {
			// 凄い二度手間だがここでは対象プレイヤーのaction情報が無いのでセットする。その後status変更の要求を出す。
			const service = scene.getService();
			const player = service.getPlayerById(ev.data.playerId);
			const actionModel = ev.data.playerAction;
			if (!player || !actionModel) {
				return;
			}
			player.setAction(actionModel.name, actionModel.value);
			player.resetRemainingTime();
			scene.hidePokerController();
			// PLAYER_THINKING_TIMEを消すためにchangeStatusメソッドを使用
			scene.changeStatus("PLAYER_DESIDE");
		}
	};
}

export const createLoopHandler = (scene: GameScene) => {
	return () => {
		const service = scene.getService();
		service.elapseGameTime((1 / g.game.fps) * 1000);
		scene.displayStructure();
		const status = scene.getCurrentStatus();
		const noneStatuses = ["DRAWING", "NONE", "WAITING"];
		if (noneStatuses.some(target => status === target)) {
			return;
		}
		const continueStatuses = ["PLAYER_THINKING_TIME"];
		if (!continueStatuses.some(s => status === s)) {
			// シーン毎の行動+遷移
			scene.popStatus();
		}
		if (status === "GAME_START" || status === "GAME_CONTINUE") {
			// ゲーム開始時
			service.initializeGame(status === "GAME_CONTINUE");
			service.dealCards();
			scene.setCardsAndButton();
			scene.pushStatuses(["START_PHASE"/*, "DRAWING"*/]);
		} else if (status === "START_PHASE") {
			// フェーズ開始
			scene.displayPhase();
			scene.drawOpenedCards();
			scene.pushStatus("NEXT_PLAYER");
		} else if (status === "PLAYER_THINKING") {
			// プレイヤーアクション選択時
			scene.initializePokerController();
			scene.focusCurrentPlayer(true);
			scene.showPokerController();
			scene.pushStatus("PLAYER_THINKING_TIME");
		} else if (status === "PLAYER_THINKING_TIME") {
			const currentPlayer = service.getCurrentPlayer();
			if (currentPlayer.isTimeUp()) {
				const actionName: TexasHoldemAction = service.isCheck() ? "CHECK" : "FOLD";
				currentPlayer.setAction(actionName, 0);
				currentPlayer.resetRemainingTime();
				scene.hidePokerController();
				scene.changeStatus("PLAYER_DESIDE");
			} else {
				currentPlayer.updateRemainingTime((1 / g.game.fps) * 1000);
				scene.waitPlayerThinking();
			}
		} else if (status === "AI_PLAYER_THINKING") {
			const currentAiPlayer = service.getCurrentPlayer() as AiPlayerModel;
			currentAiPlayer.decideAction(service.getCurrentCallValue(), service.getMinRaiseValue());
			scene.changeStatus("PLAYER_DESIDE");
		} else if (status === "PLAYER_DESIDE") {
			// プレイヤーアクション決定時
			scene.playerAction();
			scene.changeStatusByAutomaticTiming("NEXT_PLAYER", 500);
		} else if (status === "NEXT_PLAYER") {
			scene.focusCurrentPlayer(false); // 前プレイヤーのfocusを切る
			service.nextActionPlayer();
			// 次のフェーズに移るもしくは1プレイ完了
			if (service.isEndCurrentPhase()) {
				scene.pushStatus("NEXT_PHASE");
			} else {
				if (service.getCurrentPlayer() instanceof AiPlayerModel) {
					scene.pushStatus("AI_PLAYER_THINKING");
				} else {
					scene.pushStatus("PLAYER_THINKING");
				}
			}
		} else if (status === "NEXT_PHASE") {
			// 次のフェーズへ移行
			if (service.existOnlyOneSurvivor()) {
				scene.pushStatuses(["FOLD_END"]);
			} else if (false === service.isContinueGame()) {
				scene.pushStatuses(["SHOWDOWN"]);
			} else {
				service.moveNextPhase();
				scene.resetActions();
				scene.pushStatuses(["START_PHASE"/*, "DRAWING"*/]);
			}
		} else if (status === "SHOWDOWN") {
			// TODO: 無駄にshowしてしまうので、動作的に問題があれば修正する
			scene.showDown();
			if (service.isRiver()) {
				scene.changeStatusByAutomaticTiming("WIN_OR_LOSS_DECISION");
			} else {
				service.moveNextPhase();
				scene.changeStatusByAutomaticTiming("START_PHASE");
			}
		} else if (status === "WIN_OR_LOSS_DECISION" || status === "FOLD_END") {
			// ショーダウン後の勝敗判定と1人以外フォールドでそれぞれ違う処理だが、今の所内部でやることは同じなのでまとめてしまっている
			scene.resetActions();
			scene.drawWinLoss();
			scene.changeStatusByAutomaticTiming("JUDGE_CONTINUE_GAME", 1500);
		} else if (status === "JUDGE_CONTINUE_GAME") {
			scene.seatOpen();
			if (service.isFinished()) {
				scene.changeStatusByAutomaticTiming("GAME_END", 1000);
			} else {
				scene.changeStatusByAutomaticTiming("WAIT_NEXT_GAME", 1000);
			}
		} else if (status === "WAIT_NEXT_GAME") {
			// 諸々リセット処理
			scene.resetAll();
			scene.pushStatus("GAME_CONTINUE");
		} else if (status === "GAME_END") {
			service.recordPlayers(); // シーン遷移前にまとめて残っているプレイヤーの順位集計してしまう
			g.game.pushScene(new ResultScene({
				game: g.game,
				assetIds: (JSON.parse((g.game.assets["assetIdsConfig"] as g.TextAsset).data) as AssetIds).result,
				playerResults: service.getPlayerResults(),
				gameMode: service.getGameMode()
			}));
		}
	};
};
