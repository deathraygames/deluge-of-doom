RocketBoots.loadComponents([
	"Game",
	"Coords",
	"StateMachine",
	"Loop",
	"Keyboard"
]).ready(function(){

	const states = {
		"setup": {
			start: startSetup
		},
		"splash": {
			start: startSplashState,
			end: endSplashState
		},
		"game": {
			start: startGame,
			end: stopGame
		},
		"end": {
			start: endGame,
			end: closeEndGame
		}
	};

	const g = new RocketBoots.Game({
		name: "Deluge of Doom",
		instantiateComponents: [
			{"state": "StateMachine", "options": {"states": states}},
			{"loop": "Loop"},
			{"keyboard": "Keyboard"}
		],
		version: "ld42-v1.0.1"
	});
	window.g = g;
	
	const canvasElt = document.getElementById("pixi-view");
	console.log(canvasElt);
	const pixiTextureCache = PIXI.utils.TextureCache;
	const app = new PIXI.Application({
		width: canvasElt.offsetWidth, // document.documentElement.clientWidth,
		height: canvasElt.offsetHeight, //document.documentElement.clientHeight,
		transparent: true,
		antialias: false,
		roundPixels: true
	});
	PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
	
	canvasElt.appendChild(app.view);

	// g.worldContainer = new PIXI.Container();
	// app.stage.addChild(g.worldContainer);
	// {
	// 	let planetStageSize = grid.getStageCoordsFromGridXY(GRID_SIZE_X, GRID_SIZE_Y);
	// 	g.planet.x = (app.renderer.width - planetStageSize.x) / 2;
	// 	g.planet.y = (app.renderer.height - planetStageSize.y) / 6;
	// }

	app.stage.interactive = true;

	// Create the game-specific world
	g.world = new World();
	g.world.generateTerrain();
	g.world.generateBuildings('A', 16);
	g.world.generateBuildings('C', 5);
	g.world.generatePeople();

	// Center the stage
	app.stage.y += 800; // TODO: base on world / center

	g.containers = createContainersOnStage([
		"world",
		"buildings",
		"people",
		"water",
		"smoke*",
		"stats",
		"tool"
	], app.stage);

	const MERBAL0 = "images/merbal1.png";

	g.textStyle = new PIXI.TextStyle({
		fontFamily: 'Mouse Memoirs',
		fontSize: 16,
		fill: '#170e19',
		//stroke: '#c0d1cc',
		//strokeThickness: 1,
		wordWrap: true,
		wordWrapWidth: 100
	});

	// var defaultIcon = "url('images/LD42x42.png'),auto";
	// var hoverIcon = "url('required/assets/bunny_saturated.png'),auto";
	// app.renderer.plugins.interaction.cursorStyles.default = defaultIcon;
	// app.renderer.plugins.interaction.cursorStyles.hover = hoverIcon;

	g.mouseStagePos = {x: 0, y: 0};
	g.tool = null;
	g.won = false;
	g.state.transition('setup');

	// Expose some stuff
	g.app = app;
	console.log(g);
	return g;

/*----------------------------------------------------------------------------*/

	function startSetup() {
		setupEvents(canvasElt, app.stage);

		const textures = [MERBAL0];
		_.each(BUILDING_TYPES, (type) => {
			textures.push(type.textureFilePath);
		});

		PIXI.loader
			.add(textures)
			.load(finishSetup);
	}

	function finishSetup() {
		setupGraphics();
		g.state.transition('splash');
	}

	function startSplashState() {
		console.log("splash");
		document.getElementById("page").classList.add("show-splash");
	}

	function endSplashState() {
		console.log('end');
		document.getElementById("page").classList.remove("show-splash");
	}

	function goToStart() {
		g.state.transition('game');
	}

	function setupEvents(canvasElt, stage) {
		// Stage click
		stage.on('tap', onStageClick);
		stage.on('click', onStageClick);
		//stage.on('mousemove touchmove', onStageClick);
		//stage.on('mousemove touchmove', onStageClick);

		// Ability to click and drag to pan around
		g.panner = new Panner();
		g.panner.setup(canvasElt, moveStage);

		addClickEvent('start', goToStart);
		addClickEvent('return', goToStart);

		// Action Tools
		addClickEvent('tool-C', toggleBuildCarbonFactory);
		addClickEvent('tool-S', toggleBuildSolarFactory);
		addClickEvent('tool-A', toggleBuildApartmentFactory);
		addClickEvent('tool-H', toggleBuildHouseFactory);
		addClickEvent('tool-stats', toggleStatsOverlay);
	}

	function addClickEvent(eltId, fn) {
		document.getElementById(eltId).addEventListener('click', fn);
	}

	function toggleBuildCarbonFactory(e) { toggleTool(e, 'C'); }
	function toggleBuildSolarFactory(e) { toggleTool(e, 'S'); }
	function toggleBuildApartmentFactory(e) { toggleTool(e, 'A'); }
	function toggleBuildHouseFactory(e) { toggleTool(e, 'H'); }

	function toggleTool(e, type) {
		const toolsClassList = document.getElementById('tools').classList;
		toolsClassList.remove('tool-' + g.tool);
		if (g.tool === type) {
			g.tool = null;
		} else {
			g.tool = type;
			toolsClassList.add('tool-' + type);
		}
	}

	function toggleStatsOverlay() {
		clearTool();
		g.statsOverlay = !g.statsOverlay;
		const fn = (g.statsOverlay) ? 'add' : 'remove';
		document.getElementById('tool-stats').classList[fn]('active');
		// TODO: turn on stats somehow
	}

	function clearTool() {
		const toolsClassList = document.getElementById('tools').classList;
		toolsClassList.remove('tool-' + g.tool);
		g.tool = null;		
	}

	function onStageClick(e) {
		// console.log(e);
		if (g.tool === 'switch') {
			// const building = g.world.findBuildingNear(g.mouseStagePos.x, g.mouseStagePos.y);
			// if (building) {
			// 	building.toggleOn();
			// }
		} else if (g.tool) {
			createNewBuilding();
		}
		updateBuildingGraphics(g.world, g.containers.buildings, PIXI);
	}

	function createNewBuilding() {
		const building = new Building(g.tool, g.mouseStagePos.x, false);
		const tooCloseToNeighbor = g.world.isBuildingTooCloseToNeighbors(building);
		if (!tooCloseToNeighbor) {
			g.world.addBuilding(building);
			clearTool();
			createStatsSpritesForBuilding(building, g.world, g.containers.stats);
		}
	}

	function onBuildingClick(e) {
		const building = e.target.entity;
		building.toggleOn();
	}

	function onPersonClick(e) {
		console.log(e.target, e.target.entity);
	}


	function moveStage(delta) {
		g.app.stage.x -= (delta.x * 1.3);
		g.app.stage.y -= (delta.y * 1.3);
	}

	function createContainersOnStage(containerNames) {
		const containers = {};
		_.each(containerNames, (containerName) => {
			if (containerName.endsWith("*")) {
				containerName = containerName.substr(0, containerName.length - 1);
				containers[containerName] = new PIXI.particles.ParticleContainer(5000, {alpha: true})
			} else {
				containers[containerName] = new PIXI.Container();
			}
			app.stage.addChild(containers[containerName]);
		});
		return containers;
	}

	function createWorldGraphics(world, PIXI) {
		const terragon = new PIXI.Polygon(world.getPolygonCoordinates());
		const graphics = new PIXI.Graphics();

		graphics.beginFill(0x4f7754); // 0x775c4f);
		//graphics.lineStyle(5, 0x3a604a, 1);
		graphics.drawShape(terragon);
		graphics.endFill();

		// Center point
		// graphics.beginFill(0xFFFF0B, 0.1);
		// graphics.lineStyle(1, 0xFFFF0B, 0);
		// graphics.drawCircle(0, 0, 10);
		// graphics.endFill();

		return graphics;
	}

	function createBuildingsGraphics() {
		updateBuildingGraphics(g.world, g.containers.buildings, PIXI);
	}

	function updateBuildingGraphics(world, container, PIXI) {
		container.removeChildren();
		const graphics = new PIXI.Graphics();
		graphics.clear();
		g.world.buildings.forEach((building) => {
			// Light
			if (building.isConstructed()) {
				graphics.beginFill(building.on ? 0xa19f7c : 0x2f213b, 1);
				graphics.lineStyle(0, 0x775c4f, 1);
				const lightPolygon = getBuildingLightPolygon(building, world);
				graphics.drawShape(lightPolygon);
				graphics.endFill();
			}
			// Building sprite
			let texture = pixiTextureCache[building.getType().textureFilePath];
			const s = new PIXI.Sprite(texture);
			s.x = building.x;
			s.y = building.getYCoordinate(world);
			s.width = building.getWidth();
			s.height = building.getHeight() * building.getConstructionFraction();
			s.anchor.set(0.5, 1);
			s.interactive = true;
			s.buttonMode = true;
			s.on("pointerup", onBuildingClick);
			// s.on("pointerover", onSpriteOver);
			// s.on("pointerout", onSpriteOut);
			container.addChild(s);
			// Link together
			linkSpriteToEntity(s, building);
		});
		container.addChild(graphics);
	}

	function linkSpriteToEntity(sprite, entity, name) {
		name = name || 'sprite';
		entity[name] = sprite;
		sprite.entity = entity;
	}

	function getBuildingLightPolygon(building, world) {
		const w = building.getWidth();
		const h = building.getHeight();
		const y = building.getYCoordinate(world);
		const left = building.x - (w/5);
		const right = building.x + (w/6);
		const top = y - (h/3);
		const bottom = y - (h/4);
		const coords = [left, bottom, left, top, right, top, right, bottom, left, bottom];
		const polygon = new PIXI.Polygon(coords);
		return polygon;	
	}

	function getBuildingPolygon(building, world) {
		const w = building.getWidth();
		const h = building.getHeight();
		const y = building.getYCoordinate(world);
		const constructionTop = y - (h * building.getConstructionFraction());
		const top = y - h;
		const left = building.x - (w/2);
		const right = building.x + (w/2);
		const coords = [left, y, left, constructionTop, right, top, right, y, left, y];
		const polygon = new PIXI.Polygon(coords);
		return polygon;
	}

	function createWaterGraphics(world, PIXI) {
		const graphics = new PIXI.Graphics();
		updateWaterGraphics(world, graphics);
		return graphics;
	}

	function updateWaterGraphics(world, graphics) {
		const topY = world.getCurrentWaterLevel();
		const minX = -1 * world.length;
		const maxX = world.length * 2;
		const midX = (minX + maxX) / 2;
		const deepY = world.landDepthLevel;

		graphics.clear();
		graphics.beginFill(0x65738c, 0.9);
		graphics.lineStyle(5, 0x7c94a1, 1);

		graphics.moveTo(minX, topY);
		// TODO: Make this wavey and animated
		graphics.quadraticCurveTo(
			midX, topY,
			maxX, topY
		);
		graphics.lineTo(maxX, deepY / 10);
		graphics.quadraticCurveTo(
			midX, deepY * 4,
			minX, deepY / 10
		);
		return graphics;
	}

	function createPersonGraphics(world, container) {
		let texture = pixiTextureCache[MERBAL0];
		world.people.forEach((person) => {
			const s = new PIXI.Sprite(texture);
			s.x = person.x;
			s.y = person.y;
			s.width = 18;
			s.height = 18;
			s.anchor.set(0.5);
			s.interactive = true;
			s.buttonMode = true;
			s.on("pointerup", onPersonClick);
			// s.on("pointerover", onSpriteOver);
			// s.on("pointerout", onSpriteOut);
			container.addChild(s);
			// Link together
			linkSpriteToEntity(s, person);
		});
	}

	function updateToolGraphics(world, mousePos, container) {
		let graphics = container.children[0];
		if (graphics) {
			graphics.clear();
		} else {
			graphics = new PIXI.Graphics();
			container.addChild(graphics);
		}
		if (!g.tool) { return; }

		if (g.tool === 'switch') {	
			graphics.beginFill(0x170e19, 0.9);
			graphics.lineStyle(5, 0xc0d1cc, 1);
			graphics.drawCircle(mousePos.x, mousePos.y, 10);
		} else {
			const building = new Building(g.tool, mousePos.x, true);
			const tooCloseToNeighbor = world.isBuildingTooCloseToNeighbors(building);
			const polygon = getBuildingPolygon(building, world);
			graphics.beginFill(0xc0d1cc, tooCloseToNeighbor ? 0.1 : 0.5);
			graphics.lineStyle(5, tooCloseToNeighbor ? 0x3b2137 : 0x4f7754, 0.5);
			graphics.drawShape(polygon);
		}
		graphics.endFill();
	}

	function createStatsSprites(world, container) {
		world.buildings.forEach((b) => {
			createStatsSpritesForBuilding(b, world, container);
		});
	}

	function createStatsSpritesForBuilding(building, world, container) {
		const text = new PIXI.Text(building.getStats(), g.textStyle);
		linkSpriteToEntity(text, building, 'textSprite');
		text.x = building.x - (building.getWidth()/2);
		text.y = building.getYCoordinate(world) + 10;
		text.visible = false;
		container.addChild(text);
	}

	function updateStatsSprites(world) {
		world.buildings.forEach((b) => {
			b.textSprite.text = b.getStats();
			b.textSprite.visible = g.statsOverlay;
		});
	}



	function startGame() {
		// Setup and start loops
		g.loop.set(thinkingLoop, 100);
		g.loop.start();
		app.ticker.add(tickerLoop);

		toggleStatsOverlay();
	}

	function stopGame() {
		g.loop.stop();
	}

	function setupGraphics() {
		g.containers.world.addChild(createWorldGraphics(g.world, PIXI));
		createBuildingsGraphics();
		g.containers.water.addChild(createWaterGraphics(g.world, PIXI));
		createPersonGraphics(g.world, g.containers.people);
		createStatsSprites(g.world, g.containers.stats);
	}

	function thinkingLoop(i, delta) {
		g.world.progress(delta);
		writeValues(g.world);
		updateBuildingGraphics(g.world, g.containers.buildings, PIXI);

		if (g.world.pollution <= 0 && !g.won) {
			g.won = true;
			g.state.transition("end");
		}
	}

	function writeValues(world) {
		writeValue('pollution-value', world.pollution);
		writeValue('pollution-rate-value', world.pollutionRate);
		writeValue('melting-rate-value', world.meltingRate);

		writeValue('total-boxes-value', world.getTotalBoxes());
		writeValue('max-boxes-value', world.getMaxBoxes());
		writeValue('happiness-value', world.getTotalHappiness());
		writeValue('housing-value', world.getHousingPercentage());
		writeValue('employment-value', world.getEmploymentPercentage());
		document.getElementById('time-until-water-rise').innerHTML = world.getTimeUntilWaterRise();
	}

	function writeValue(eltId, value) {
		document.getElementById(eltId).innerHTML = Math.round(value).toLocaleString();
	}

	function tickerLoop() {
		const mousePos = app.renderer.plugins.interaction.mouse.global;
		g.mouseStagePos.x = mousePos.x - g.app.stage.x;
		g.mouseStagePos.y = mousePos.y - g.app.stage.y;

		const waterGraphics = g.containers.water.children[0];
		updateWaterGraphics(g.world, waterGraphics);
		updateToolGraphics(g.world, g.mouseStagePos, g.containers.tool);
		updateStatsSprites(g.world);
	}

	function endGame() {
		document.getElementById("page").classList.add("show-end");
	}

	function closeEndGame() {
		document.getElementById("page").classList.remove("show-end");	
	}



}).init();