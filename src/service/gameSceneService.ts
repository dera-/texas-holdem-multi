import { PlayerModelParameterObject, PlayerModel, Position } from "../model/playerModel";
import { BoardModel, ChipPot } from "../model/boardModel";
import { StructureModelParameterObject, StructureModel, StructureData } from "../model/structureModel";
import { DealerModel } from "../model/dealerModel";
import { generateCardModels, CardModel } from "../model/cardModel";
import { ActionModel, TexasHoldemAction } from "../model/actionModel";
import { RankModel } from "../model/rankModel";
import { compareRanks } from "../util/rankUtil";
import { OneGameResultModel } from "../model/oneGameResultModel";
import { GameMode } from "../type/gameMode";
import { PlayerResultModel } from "../model/playerResultModel";
import { AiPlayerModel, AiPlayerModelParameterObject } from "../model/aiPlayerModel";

export const enum TexasHoldemPhase {
	PRE_FLOP = 0,
	FLOP = 1,
	TURN = 2,
	RIVER = 3
};

export interface GameSceneServiceParameterObject { 
	mode: GameMode;
	players: PlayerModelParameterObject[];
	structure: StructureModelParameterObject;
	random?: g.RandomGenerator;
}

export interface PlayerRank {
	id: string;
	rank: RankModel;
}

export const TOP_SEAT_NUMBER = 0;
const NON_EXIST_SEAT_NUMBER = -1;
const NON_EXIST_PLAYER_INDEX = -1;
const FROP_CARDS_NUM = 3;

export class GameSceneService {
	private playerModels: PlayerModel[];
	private playerResultModels: PlayerResultModel[];
	private boardModel: BoardModel;
	private dealerModel: DealerModel;
	private structureModel: StructureModel;
	// 現在のブラインド。コンストラクタで初期化、initializeGameメソッドでのみ更新する。
	private currentBlindData: StructureData;
	private bbSeatNumber: number;
	private sbSeatNumber: number;
	private dealerSeatNumber: number;
	private currentPlayerIndex: number;
	private originalRaiserIndex: number;
	private currentCallValue: number;
	private minRaiseValue: number;
	private actionPhase: TexasHoldemPhase;
	private initialiPlayersCount: number;
	private gameMode: GameMode;
	private random: g.RandomGenerator;

	constructor(param: GameSceneServiceParameterObject) {
		this.random = param.random || g.game.random;
		this.playerModels = param.players.map(p => { 
			if ((p as AiPlayerModelParameterObject).aiType) {
				return new AiPlayerModel({ ...(p as AiPlayerModelParameterObject), random: this.random });
			} else {
				return new PlayerModel(p);
			}
		});
		this.boardModel = new BoardModel();
		this.dealerModel = new DealerModel(generateCardModels(), this.random);
		this.structureModel = new StructureModel(param.structure);
		
		this.currentPlayerIndex = 0;
		this.originalRaiserIndex = NON_EXIST_PLAYER_INDEX;
		this.currentCallValue = 0;
		this.minRaiseValue = this.currentCallValue * 2;
		this.actionPhase = TexasHoldemPhase.PRE_FLOP;
		this.initialiPlayersCount = this.playerModels.length;
		const bbIndex = Math.floor(this.initialiPlayersCount * this.random.generate());
		this.bbSeatNumber = this.playerModels[bbIndex].getSeatNumber();
		this.sbSeatNumber = NON_EXIST_SEAT_NUMBER;
		this.dealerSeatNumber = NON_EXIST_SEAT_NUMBER;

		this.playerResultModels = [];
		this.gameMode = param.mode;
		this.currentBlindData = this.structureModel.getCurrentStructure();
	}

	/**
	 * ゲームが終了したかどうかの判定
	 */
	isFinished(): boolean {
		return this.playerModels.length <= 1 || this.structureModel.isFinished();
	}

	/**
	 * 残っているPlayerをResult配列に記録する
	 */
	recordPlayers(): void {
		// スタックが少ない順にソート
		const suvivers = this.playerModels.sort((a, b) => a.getStack() - b.getStack());
		suvivers.forEach(p => {
			this.playerResultModels.unshift({
				player: p,
				place: this.initialiPlayersCount - this.playerResultModels.length,
				stack: p.getStack()
			});
		});
	}

	getPlayerResults(): PlayerResultModel[] {
		return this.playerResultModels;
	}

	getDeadPlayers(): PlayerModel[] {
		const deads = this.playerModels.filter(player => {
			return !player.hasChip();
		});
		if (deads.length >= 2) {
			// オールインの額が少ない順にソート
			return deads.sort((a, b) => {
				const actionA = a.getAction();
				const actionB = b.getAction();
				if (!actionA) {
					return -1;
				} else if (!actionB) {
					return 1;
				} else {
					return actionA.value - actionB.value;
				}
			});
		}
		return deads;
	}

	/**
	 * スタックが0になったプレイヤーをゲーム内から除外してResult配列に記録する処理
	 */
	deleteDeadPlayer(): void {
		this.getDeadPlayers().forEach(p => {
			this.playerResultModels.unshift({
				player: p,
				place: this.initialiPlayersCount - this.playerResultModels.length,
				stack: 0 // 飛んでいるので残りスタックは必ず0になる
			});
			this.playerModels.splice(this.playerModels.indexOf(p), 1);
		});
	}

	isSurvive(id: string): boolean {
		return this.playerModels.some(player => player.getId() === id);
	}

	resetBord(): void {
		this.boardModel.clear();
	}

	resetPlayersAction(): void {
		this.playerModels.forEach((player) => {
			player.resetAction();
		});
	}

	initializeGame(next: boolean = true): void {
		this.actionPhase = TexasHoldemPhase.PRE_FLOP;
		if (next) {
			this.bbSeatNumber = this.getBbSeatNumber();
		}
		for (let index = 0; index < this.playerModels.length; index++) {
			this.playerModels[index].setPosition(Position.OTHER);
		}
		this.currentBlindData = this.structureModel.getCurrentStructure();
		const bigBlindPlayer = this.getPlayerBySeatNumber(this.bbSeatNumber);
		bigBlindPlayer.setAction("NONE", this.currentBlindData.bigBlind);
		this.addChipToPod(bigBlindPlayer.getId(), true);
		bigBlindPlayer.setPosition(Position.BIG_BLIND);
		const pastSbSeatNumber = this.sbSeatNumber;
		const nextSbSeatNumber = this.getFollowSeatNumber(this.bbSeatNumber);
		this.sbSeatNumber = nextSbSeatNumber === pastSbSeatNumber ? NON_EXIST_SEAT_NUMBER : nextSbSeatNumber;
		if (this.playerModels.length === 2) {
			this.dealerSeatNumber = this.sbSeatNumber;
			const otherPlayer = this.playerModels.filter(p => p !== bigBlindPlayer)[0];
			otherPlayer.setAction("NONE", this.currentBlindData.smallBlind);
			this.addChipToPod(otherPlayer.getId(), true);
			otherPlayer.setPosition(Position.DEALER_FOR_HEADS_UP);
			return;
		} else {
			const pastDealerSeatNumber = this.dealerSeatNumber;
			const nextDealerSeatNumber = this.getFollowSeatNumber(nextSbSeatNumber);
			this.dealerSeatNumber = nextDealerSeatNumber === pastDealerSeatNumber ? NON_EXIST_SEAT_NUMBER : nextDealerSeatNumber;
			const smallBlindPlayer = this.getPlayerBySeatNumber(this.sbSeatNumber);
			if (smallBlindPlayer) {
				smallBlindPlayer.setAction("NONE", this.currentBlindData.smallBlind);
				this.addChipToPod(smallBlindPlayer.getId(), true);
				smallBlindPlayer.setPosition(Position.SMALL_BLIND);
			}
			const dealerPlayer = this.getPlayerBySeatNumber(this.dealerSeatNumber);
			if (dealerPlayer) {
				dealerPlayer.setPosition(Position.DEALER);
			}
		}
	}

	private getBbSeatNumber(): number {
		for (let i = 1; i < this.initialiPlayersCount; i++) {
			const seatNumber = (this.bbSeatNumber + i) % this.initialiPlayersCount;
			const player = this.getPlayerBySeatNumber(seatNumber);
			if (player) {
				return seatNumber;
			}
		}
		return this.bbSeatNumber;
	}

	// SBとかボタンの場所決める時に使うやつ
	private getFollowSeatNumber(target: number): number {
		for (let i = 1; i < this.initialiPlayersCount; i++) {
			const seatNumber = target - i < 0 ? target - i + this.initialiPlayersCount : target - i;
			const player = this.getPlayerBySeatNumber(seatNumber);
			if (player) {
				return seatNumber;
			}
		}
		// 多分ここには来ないというか来たら多分エラーだが、ゲームは続けたいのでNON_EXIST_SEAT_NUMBERだけ返しておく
		return NON_EXIST_SEAT_NUMBER;
	}

	dealCards(): void {
		this.dealerModel.shuffleCards();
		// 変な配り方しているけど、ロジック部分なので。。
		this.playerModels.forEach((player) => {
				let cards = [this.dealerModel.getNextCard(), this.dealerModel.getNextCard()];
				player.setCards(cards);
		});
	}

	startPhase(): CardModel[] {
		const openedCards: CardModel[] = [];
		//ボードにカードを公開する
		if (this.actionPhase === TexasHoldemPhase.FLOP) {
			// とりあえず、バーンカードは無しで。。
			for (let i = 0; i < FROP_CARDS_NUM; i++) {
				const card: CardModel = this.dealerModel.getNextCard();
				openedCards.push(card);
				this.boardModel.setCard(card);
			}
		} else if (this.actionPhase === TexasHoldemPhase.TURN || this.actionPhase === TexasHoldemPhase.RIVER) {
			const card: CardModel = this.dealerModel.getNextCard();
			openedCards.push(card);
			this.boardModel.setCard(card);
		}
		// メンバ変数リセット
		const initialPlayerIndex = this.getInitialPlayerIndex();
		// 本当はダメだけど、最初のプレイヤーを決める時もnextActionPlayerメソッドを使うので1つ前から開始ということにする
		this.currentPlayerIndex = initialPlayerIndex === 0 ? this.playerModels.length -1 : initialPlayerIndex - 1;
		this.originalRaiserIndex = NON_EXIST_PLAYER_INDEX;
		if (this.actionPhase === TexasHoldemPhase.PRE_FLOP) {
			this.currentCallValue = this.currentBlindData.bigBlind;
			this.minRaiseValue = this.currentCallValue * 2;
		} else {
			this.currentCallValue = 0;
			this.minRaiseValue = this.currentBlindData.bigBlind;
		}
		return openedCards;
	}

	private getInitialPlayerIndex(): number {
		let targetSeatNumber;
		if (this.actionPhase === TexasHoldemPhase.PRE_FLOP) {
			targetSeatNumber = (this.bbSeatNumber + 1) % this.initialiPlayersCount;
		} else if (this.playerModels.length === 2) {
			targetSeatNumber = this.bbSeatNumber;
		} else {
			targetSeatNumber = (this.bbSeatNumber + this.initialiPlayersCount -1) % this.initialiPlayersCount;
		}
		for (let i = 0; i < this.initialiPlayersCount; i++) {
			const player = this.getPlayerBySeatNumber((targetSeatNumber + i) % this.initialiPlayersCount);
			if (player) {
				return this.playerModels.indexOf(player);
			}
		}
		throw new Error("target player not found");
	}

	getCurrentPlayer(): PlayerModel {
		return this.playerModels[this.currentPlayerIndex];
	}

	getPlayerById(playerId: string): PlayerModel | null {
		const targets = this.playerModels.filter(player => player.getId() === playerId);
		return targets.length > 0 ? targets[0] : null;
	}

	getPlayerBySeatNumber(seatNumber: number): PlayerModel | null {
		const targets = this.playerModels.filter(player => player.getSeatNumber() === seatNumber);
		return targets.length > 0 ? targets[0] : null;
	}

	getPlayersCount(): number {
		return this.playerModels.length;
	}

	getCurrentPlayerAction(): ActionModel | null {
		const action = this.playerModels[this.currentPlayerIndex].getAction();
		if (action !== null && action.name === "FOLD") {
			this.playerModels[this.currentPlayerIndex].dumpCards();
		}
		return action;
	}

	isEndCurrentPhase(): boolean {
		if (this.currentPlayerIndex === NON_EXIST_PLAYER_INDEX || this.existOnlyOneSurvivor()) {
			return true;
		}
		const player = this.getCurrentPlayer();
		const action = player.getAction();
		return this.getActivePlayers().length < 2
			&& (this.currentCallValue === 0 || (action && action.value >= this.currentCallValue));
	}

	nextActionPlayer(): void {
		// オリジナルレイザーが変わった場合
		const currentPlayerAction = this.getCurrentPlayerAction();
		if (currentPlayerAction &&
			(currentPlayerAction.name === "RAISE" ||
			(currentPlayerAction.name === "ALLIN" && currentPlayerAction.value > this.currentCallValue))) {
			this.originalRaiserIndex = this.currentPlayerIndex;
			const pastCallValue = this.currentCallValue;
			this.currentCallValue = currentPlayerAction.value;
			this.minRaiseValue = this.currentCallValue + (this.currentCallValue - pastCallValue);
		}
		this.currentPlayerIndex = this.searchNextPlayerIndex(this.currentPlayerIndex, this.originalRaiserIndex, this.currentCallValue);
	}

	moveNextPhase(): void {
		this.actionPhase++;
	}

	showdown(): CardModel[] {
		let cards: CardModel[] = [];
		while (this.actionPhase < TexasHoldemPhase.RIVER) {
			this.actionPhase++;
			cards = cards.concat(this.startPhase());
		}
		return cards;
	}

	existOnlyOneSurvivor(): boolean {
		const survivors: PlayerModel[] = this.playerModels.filter((player) => {
			return player.hasHand();
		});
		return survivors.length === 1;
	}

	isContinueGame(): boolean {
		if (this.actionPhase === TexasHoldemPhase.RIVER) {
			return false;
		}
		return this.getActivePlayers().length >= 2;
	}

	private getActivePlayers(): PlayerModel[] {
		return this.playerModels.filter((player) => {
			const action = player.getAction();
			return (action === null || (action.name !== "FOLD" && action.name !== "ALLIN"));
		});
	}

	searchNextPlayerIndex(initialPlayerIndex: number, originalRaiserIndex: number, currentCallValue: number): number {
		const playerNum = this.playerModels.length;
		for (let i = 1; i < playerNum; i++) {
			const currentPlayerIndex = (initialPlayerIndex + i) % playerNum;
			const currentPlayer = this.playerModels[currentPlayerIndex];
			const currentPlayerAction = currentPlayer.getAction();
			// オリジナルレイザーまで回ってきたら終了
			if (currentPlayerIndex === originalRaiserIndex) {
				return NON_EXIST_PLAYER_INDEX;
			}
			if (false === currentPlayer.isActive()) {
				continue;
			}
			if (currentPlayerAction === null || currentPlayerAction.name === "NONE" ||
				(currentPlayerAction.name !== "ALLIN" && currentPlayerAction.name !== "FOLD" && currentPlayerAction.value < currentCallValue)
			) {
				return currentPlayerIndex;
			}
		}
		return NON_EXIST_PLAYER_INDEX;
	}

	addChipToPod(playerId: string, isBlind: boolean = false): void {
		const player = this.getPlayerById(playerId);
		if (!player) {
			throw new Error(`not found player(id: ${playerId})`);
		}
		const action = player.getAction();
		if (!action) {
			throw new Error(`not found ${player.getName()}'s action`);
		}
		if (isBlind || action.name === "ALLIN" || action.name === "RAISE" || action.name === "CALL") {
			this.boardModel.addChip({id: playerId, chip: player.getValueToPay()});
			player.payDiffChip();
		}
	}

	getHasHandPlayers(): PlayerModel[] {
		return this.playerModels.filter(player => player.hasHand());
	}

	getGameResults(): OneGameResultModel[] {
		const results: OneGameResultModel[] = [];
		const boardCards: CardModel[] = this.boardModel.getOpenedCards();
		const candidates: PlayerModel[] = this.getHasHandPlayers();
		if (candidates.length === 1) {
			return this.boardModel.takePotForSurvivor(candidates[0].getId()).map(pot => { return { id: pot.id, rank: null, value: pot.chip }; });
		}
		const playDataArray: OneGameResultModel[] = candidates.map(player => {
			const id = player.getId();
			const rank: RankModel = player.getRank(boardCards);
			const value: number = this.boardModel.getPotById(player.getId()).chip;
			return { id, rank, value };
		}).sort((a, b) => {
			const compare = compareRanks(a.rank, b.rank);
			if (compare === 0) {
				return a.value < b.value ? 1 : -1; 
			} else {
				return -1 * compare;
			} 
		});
		for (let i = 0; i < playDataArray.length; i++) {
			const rank = playDataArray[i].rank;
			const playerId = playDataArray[i].id;
			const ids = [playerId];
			for (let j = i + 1; j < playDataArray.length; j++) {
				if (compareRanks(rank, playDataArray[j].rank) !== 0) {
					break;
				}
				ids.push(playDataArray[j].id);
			}
			this.boardModel.takePotForMulti(ids).forEach(pot => {
				results.push({ id: pot.id, rank, value: pot.chip });
			});
			// idsの長さが1以下になることはないので本来このif文は不要だが、念のため
			if (ids.length >= 2) {
				i += ids.length - 1;
			}
		}
		return results;
	}

	updatePlayersStack(results: OneGameResultModel[]): void {
		results.forEach(result => {
			const player = this.getPlayerById(result.id);
			player.addStack(result.value);
		});
	}

	getPlayerRanks(): PlayerRank[] {
		const boardCards: CardModel[] = this.boardModel.getOpenedCards();
		return this.playerModels.map(player => {
			return {id: player.getId(), rank: player.getRank(boardCards)};
		});
	}

	getBigBlindValue(): number {
		return this.currentBlindData.bigBlind;
	}

	getSmallBlindValue(): number {
		return this.currentBlindData.smallBlind;
	}

	getChipPots(): ChipPot[] {
		return this.boardModel.getChipPots();
	}

	getPotValue(): number {
		return this.boardModel.getPotValue();
	}

	getPhaseString(): string {
		switch (this.actionPhase) {
			case TexasHoldemPhase.PRE_FLOP:
				return 'プリフロップ';
			case TexasHoldemPhase.FLOP:
				return 'フロップ';
			case TexasHoldemPhase.TURN:
				return 'ターン';
			case TexasHoldemPhase.RIVER:
				return 'リバー';
			default:
				return '';
		}
	}

	isRiver(): boolean {
		return this.actionPhase === TexasHoldemPhase.RIVER;
	}

	getActionPhase(): TexasHoldemPhase {
		return this.actionPhase;
	}

	getMinRaiseValue(): number {
		return this.minRaiseValue;
	}

	getCurrentCallValue(): number {
		return this.currentCallValue;
	}

	getInitialPlayersCount(): number {
		return this.initialiPlayersCount;
	}

	getGameMode(): GameMode {
		return this.gameMode;
	}

	getOpenedCards(): CardModel[] {
		return this.boardModel.getOpenedCards();
	}

	isCheck(): boolean {
		const currentAction = this.getCurrentPlayer().getAction();
		const currentCallValue = this.getCurrentCallValue();
		return currentCallValue === 0 || (currentAction && currentAction.value >= currentCallValue);
	}

	isAllin(value?: number): boolean {
		if (value === undefined) {
			value = this.getCurrentCallValue();
		}
		return this.getCurrentPlayer().getTotalStack() <= value;
	}

	elapseGameTime(time: number): void {
		this.structureModel.updateCurrentMilliSeconds(time);
		this.structureModel.nextBlind();
	}

	getBlindText(): string {
		// SB/BBをリアルタイム表示したいのでStructureModel#getStructure()を呼ぶ
		const structure = this.structureModel.getCurrentStructure();
		const nextStructure = this.structureModel.getNextStructure();
		const nextStr = nextStructure === null ? "FINAL BLIND" : `NEXT: ${nextStructure.smallBlind}/${nextStructure.bigBlind}`;
		return `SB/BB: ${structure.smallBlind}/${structure.bigBlind}\n(${nextStr})`;
	}

	getTimeText(): string {
		const time = this.structureModel.getCurrentSeconds();
		const minitue = Math.floor(time / 60);
		const minitueStr = ("00" + minitue).slice(-2);
		const second = time % 60;
		const secondStr = ("00" + second).slice(-2);
		return `TIME: ${minitueStr}:${secondStr}`;
	}

	isAudience(playerId: string): boolean {
		// ゲーム未参加者だけでなく敗退者も視聴者扱いする
		return !this.playerModels.some(player => player.getId() === playerId);
	}
}
