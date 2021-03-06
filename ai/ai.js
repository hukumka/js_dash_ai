config = {
	butterfly_chase_probability: 0.45,
	yolo_probability: 0.01,
	rock_drop_weight: 0,
	butterfly_near_weight: 0,
	dirt_eat_weight: 0.00,
	dead_warning_expire: 6,
	dead_end_weight: Infinity,

	butterfly_kill_depth: 7,

	repeating_moves_penalty: 100,
	repeating_moves_expire: 8,

	graph_max_distance: 12
}


exports.play = function*(screen){
	let world = new World(screen.slice(0, -1));
	let err = 0;
	let state = {}
	state.mark_bad = create_2d_array(world.width, world.height, function(x, y){
		return {expire: 0, value: 0}
	});
	world.evalute(' ');
	yield ' '
	state.diamond = null
	state.yolo_modifier = 0
	state.history = []
	state.but_count = 3
	while(true){
		test = world.test(screen);
		if(test != null){
			world = new World(screen.slice(0, -1))
			world.evalute(' ');
			yield "q";
		}
		let command = improved_determine_action(world, state);
		world.evalute(command);
		if(world.dead){
			console.error("DEAD");
			//yield "q";
		}
		yield command
	}
}


function improved_determine_action(world, state){
	state.pos = world.player_pos()
	state.routes = get_butterfly_routes(world, config.butterfly_kill_depth);
	let {good, alive} = ban_dead_moves(world, state);
	state.good_moves = good
	state.gg = good
	state.alive_move = alive

	let but_kill_move = kill_butterfly(world, state)
	if(but_kill_move !== false){
		return but_kill_move
	}else{
		state.dead_end_graph = new DeadEndGraph(world.map)
		state.diamonds = []
		for(let y=0; y<world.height; ++y){
			for(let x=0; x<world.width; ++x){
				if('@*'.includes(world.map[y][x]))
					state.diamonds.push({x, y})
			}
		}
		let cell_bad = state.mark_bad[state.pos.y][state.pos.x]
		if(cell_bad.expire < world.frame){
			if(cell_bad.value == 0){
				cell_bad.value = 0.01
			}
			cell_bad.value *= config.repeating_moves_penalty
		}else{
			cell_bad.value = 0
		}
		cell_bad.expire = Math.max(world.frame+config.repeating_moves_expire, cell_bad.expire)
		state.mark_bad[state.pos.y][state.pos.x] = cell_bad

		let m = path_find_diamond(world, state)
		if(m !== false){
			return m
		}else{
			return state.good_moves[Math.floor(Math.random()*state.good_moves.length)]
		}
	}
}


function determine_action(world, state){
	state.pos = world.player_pos()
	state.routes = get_butterfly_routes(world, config.butterfly_kill_depth);
	state.diamonds = []
	let {good, alive} = ban_dead_moves(world, state);
	state.good_moves = good
	state.alive_move = alive

	/*if(state.history.length > 10){
		let old_pos = state.history[state.history.length-10]
		if(Math.abs(old_pos.x - state.pos.x) + Math.abs(old_pos.y - state.pos.y) < 4){
			state.yolo_modifier += 0.05
		}else{
			state.yolo_modifier = 0
		}
	}
	state.history.push(state.pos)*/

	let cell_bad = state.mark_bad[state.pos.y][state.pos.x]
	if(cell_bad.expire < world.frame){
		if(cell_bad.value == 0){
			cell_bad.value = 0.01
		}
		cell_bad.value *= config.repeating_moves_penalty
	}else{
		cell_bad.value = 0
	}
	cell_bad.expire = Math.max(world.frame+config.repeating_moves_expire, cell_bad.expire)
	state.mark_bad[state.pos.y][state.pos.x] = cell_bad

	// Butterfly kill attempts
	for(let m of state.good_moves){
		let w = world.clone()
		w.evalute(m);
		if(world.frame > 4){ // hack to prevent fall
			for(let mm of ['l', 'r', 'u', 'd']){
				let ww = w.clone()
				ww.evalute(mm);
				if(is_butterfly_killed(ww)){
					return m;
				}
			}
		}

		if(is_butterfly_killed(w)){
			return m;
		}
	}

	for(let y=0; y<world.height; ++y){
		for(let x=0; x<world.width; ++x){
			if('@*'.includes(world.map[y][x]))
				state.diamonds.push({x, y})
		}
	}

	state.dead_end_graph = new DeadEndGraph(world.map)
	if(state.diamonds.length > 0){
		let d = path_find_diamond(world, state);
		if(d !== false){
			return d;
		}
	}

	let m = free_all_butterflies(world, state)
	if(m !== false){
		return m
	}
	return try_to_kill(world, state);
}


function is_butterfly_shrinked_circle(world){
	let routes = get_butterfly_routes(w, config.butterfly_kill_depth)
	for(let i=0; i<routes.length; ++i){
		if(is_butterfly_circle_short(routes[i])){
			return i
		}
	}
	return -1
}


function is_butterfly_circle_short(route){
	for(let i=2; i<routes.length-1; ++i){
		if(route[0].x == route[i].x && route[0].y == route[i].y && route[1].x == route[i+1].x && route[1].y == route[i+1].y){
			return true
		}
	}
	return false
}


function find_dead_ends(world){
	let map = map2d(world.map, function(e){
		return e
	});
	let q = new Heap();
	q.push({pos: world.player_pos(), prev: null})
}


function path_find_diamond(world, state){
	let player_pos = state.pos;
	let visited = create_2d_array(world.width, world.height, function(x, y){
		return Infinity;
	});
	let routes = state.routes

	let moves = new Heap();
	let {x, y} = player_pos;
	let good_moves = state.good_moves;
	if(good_moves.includes('l'))
		moves.push({initial_move: 'l', x: x-1, y: y, prev_move: 'l', prev_diamond: null, distance: 0}, 1);
	if(good_moves.includes('r'))
		moves.push({initial_move: 'r', x: x+1, y: y, prev_move: 'r', prev_diamond: null, distance: 0}, 1);
	if(good_moves.includes('u'))
		moves.push({initial_move: 'u', x: x, y: y-1, prev_move: 'u', prev_diamond: null, distance: 0}, 1);
	if(good_moves.includes('d'))
		moves.push({initial_move: 'd', x: x, y: y+1, prev_move: 'd', prev_diamond: null, distance: 0}, 1);


	if(Math.random() < config.yolo_probability + state.yolo_modifier){
		return good_moves[Math.floor(Math.random()*good_moves.length)]
	}
	if(state.diamond != null && state.pos.x == state.diamond.x && state.pos.y == state.diamond.y){
		state.diamond = null
		if(state.dist_graph !== undefined){
			let {x, y} = state.pos;
			let d_id = state.diamond_map[y][x]
			if(state.dist_graph.joints[d_id]){
				let max_node =null
				let max_size = 0
				for(let {node, size} of state.dist_graph.get_joint_scopes(d_id)){
					if(size > max_size){
						max_size = size
						max_node = node
					}
				}
				if(max_node != null){
					state.diamond = state.dist_graph.nodes[max_node].pos
				}
			}
		}
	}
	let i = 0;
	state.diamond_map = map2d(world.map, function(elem, x, y){
		if(elem == '*' || elem == '@'){
			return i++
		}else{
			return null
		}
	})
	let diamond_map = state.diamond_map
	
	state.dist_graph = new DistanceGraph(state.diamonds)
	let dist_graph = state.dist_graph

	let closest_diamond = null
	let removed_joint = null


	while(!moves.empty()){
		let {elem: move, priority} = moves.pop();
		let {initial_move, x, y, prev_move, distance} = move;
		if(visited[y][x] <= priority){
			continue;
		}
		visited[y][x] = priority;
		if(state.diamond != null && x == state.diamond.x && y == state.diamond.y && !'*@'.includes(world.map[y][x])){
			state.diamond = null
		}
		if('*@'.includes(world.map[y][x])){
			//return initial_move;
			if(closest_diamond == null){
				closest_diamond = move;
			}

			if(state.diamond != null && state.diamond.x==x && state.diamond.y == y){
				if(world.streak_end_frame - world.frame < distance - 1){
					state.diamond = null
					break
				}else{
					return initial_move;
				}
			}else if(state.diamond == null){
				if(diamond_map[y][x] != null && !dist_graph.joints[diamond_map[y][x]] && world.streak_end_frame - world.frame >= distance - 1){
					state.diamond = {x, y}
					return initial_move
				}
			}
		}else if(' :<>v^'.includes(world.map[y][x])
			|| (world.map[y][x] == 'O' && ' <>v^'.includes(world.map[y][x+1]) && prev_move == 'r')
			|| (world.map[y][x] == 'O' && ' <>v^'.includes(world.map[y][x-1]) && prev_move == 'l')
		){
			let add = 1;
			if(world.map[y-1][x] == 'O'){
				priority+=config.rock_drop_weight;
			}
			let loose1 = world.map[y-1][x] == 'O'
			let loose2 = (world.map[y-1][x-1] == 'O' && 'O*+'.includes(world.map[y][x-1])) || (world.map[y-1][x-1] == 'O' && 'O*+'.includes(world.map[y][x-1]))
			if(loose1 || loose2){
				if(state.dead_end_graph.is_dead_end(x, y)){
					add += config.dead_end_weight;
				}
			}

			if(is_butterfly_neighbor(routes, {x, y}, distance)){
				priority += config.butterfly_near_weight;
			}
			if(world.map[y][x] == ':'){
				add = 1 + config.dirt_eat_weight;
			}


			function push_move(move){
				let {x:nx, y:ny} = move_pos({x, y}, move)
				let bad = 0;
				if(state.mark_bad[y][x].expire > world.frame){
					bad = state.mark_bad[y][x].value
				}
				moves.push({initial_move, x: nx, y: ny, prev_move: move, distance: distance + 1}, priority + add + bad)
			}

			push_move('l');
			push_move('r');
			push_move('u');
			push_move('d');
		}
	}
	if(closest_diamond != null){
		state.diamond = closest_diamond
		return closest_diamond.initial_move
	}
	return false;
}


function move_pos(base_pos, move){
	let {x, y} = base_pos
	if(move == 'l'){
		return {x:x-1, y}
	}else if(move == 'r'){
		return {x: x+1, y}
	}else if(move == 'd'){
		return {x, y: y+1}
	}else if(move == 'u'){
		return {x, y: y-1}
	}else{
		return {x, y}
	}
}


function free_all_butterflies(world, state){
	let free_but = []

	let visited = create_2d_array(world.width, world.height, function(x, y){
		return Infinity;
	});
	let moves = new Heap();
	let good_moves = state.good_moves;
	let {x, y} = state.pos
	if(good_moves.includes('l'))
		if(!'*@'.includes(world.map[y][x-1]))
			moves.push({initial_move: 'l', x: x-1, y: y, prev_move: 'l'}, 1);
	if(good_moves.includes('r'))
		if(!'*@'.includes(world.map[y][x+1]))
			moves.push({initial_move: 'r', x: x+1, y: y, prev_move: 'r'}, 1);
	if(good_moves.includes('u'))
		if(!'*@'.includes(world.map[y-1][x]))
			moves.push({initial_move: 'u', x: x, y: y-1, prev_move: 'u'}, 1);
	if(good_moves.includes('d'))
		if(!'*@'.includes(world.map[y+1][x]))
			moves.push({initial_move: 'd', x: x, y: y+1, prev_move: 'd'}, 1);

	while(!moves.empty()){
		let {elem: move, priority} = moves.pop();
		let {initial_move, x, y} = move;
		if(visited[y][x] <= priority){
			continue;
		}
		visited[y][x] = priority;
		if('v^<>'.includes(world.map[y][x])){
			free_but.push({x, y})
		}
		if('*@'.includes(world.map[y][x])){
			continue
		}
		if(' '.includes(world.map[y][x])){
			if(world.map[y-1][x] == 'O'){
				priority+=config.rock_drop_weight;
			}
			function push_move(move){
				let {x:nx, y:ny} = move_pos({x, y}, move)
				let bad = 0;
				let add = 1
				/*if(state.dead_end_graph.is_dead_end(x, y)){
					add += config.dead_end_weight;
				}*/
				if(state.mark_bad[y][x].expire > world.frame){
					bad = state.mark_bad[y][x].value
				}
				moves.push({initial_move, x: nx, y: ny}, priority + add + bad)
			}

			push_move('l');
			push_move('r');
			push_move('u');
			push_move('d');
		}
	}

	
	visited = create_2d_array(world.width, world.height, function(x, y){
		return Infinity;
	});
	moves = new Heap();
    if(good_moves.includes('l'))
    	moves.push({initial_move: 'l', x: x-1, y: y, prev_move: 'l'}, 1);
    if(good_moves.includes('r'))
    	moves.push({initial_move: 'r', x: x+1, y: y, prev_move: 'r'}, 1);
    if(good_moves.includes('u'))
    	moves.push({initial_move: 'u', x: x, y: y-1, prev_move: 'u'}, 1);
    if(good_moves.includes('d'))
    	moves.push({initial_move: 'd', x: x, y: y+1, prev_move: 'd'}, 1);

	while(!moves.empty()){
		let {elem: move, priority} = moves.pop();
		let {initial_move, x, y} = move;
		if(visited[y][x] <= priority){
			continue;
		}
		if('*@'.includes(world.map[y][x])){
			continue;
		}
		visited[y][x] = priority;
		if('v^<>'.includes(world.map[y][x])){
			let is_free = false
			for(let bp of free_but){
				if(bp.x == x && bp.y == y){
					is_free = true
				}
			}
			if(!is_free){
				return initial_move
			}
		}
		if(' :'.includes(world.map[y][x])){
			if(world.map[y-1][x] == 'O'){
				priority+=config.rock_drop_weight;
			}
			function push_move(move){
				let {x:nx, y:ny} = move_pos({x, y}, move)
				let bad = 0;
				let add = 1
				/*if(state.dead_end_graph.is_dead_end(x, y)){
					add += config.dead_end_weight;
				}*/
				if(state.mark_bad[y][x].expire > world.frame){
					bad = state.mark_bad[y][x].value
				}
				moves.push({initial_move, x: nx, y: ny}, priority + add + bad)
			}

			push_move('l');
			push_move('r');
			push_move('u');
			push_move('d');
		}
	}
	return false
}


function kill_butterfly(world, state){
	let routes = get_butterfly_routes(world, 20)
	let rc = 0
	for(let r of routes){
		rc++
	}

	if(rc == 0 || world.frame > 600){
		return false
	}else{
		let gm = state.good_moves
		let fall_map = build_fall_map(world);

		let free = free_all_butterflies(world, state)
		if(free === false){
			let drops = find_killing_drops(world)
			let m = execute_killing_drop(world, state, drops)
			if(m !== false){
				return m
			}else{
				return ' '
				//return try_to_kill(world, state)
			}
		}else{
			return free
		}
	}
}


function find_killing_drops(world){
	let drops = all_drops(world)
	let routes = get_butterfly_routes(world, 40)
	let killing_drops = []
	for(let r of routes){
		for(let drop of drops){
			for(let i=0; i<r.length; ++i){
				let dr = drop.route
				for(let j=0; j*2<dr.length && j<=i; ++j){
					if(dr[j*2] == r[i].x && dr[j*2+1]+1 == r[i].y){
						drop.offset = i-j
						killing_drops.push(drop)
						i = r.length
						break
					}
				}
			}
		}
	}
	return killing_drops
}


function execute_killing_drop(world, state, drops){
	let dm = build_distance_map(world, state)
	if(state.exec_drop !== undefined && state.exec_drop.x == state.pos.x && state.exec_drop.y+1 == state.pos.y){
		state.exec_drop = undefined
		console.error('drop')
		return 'l'
	}
	for(let d of drops){
		//console.error(d.offset, dm[d.y+1][d.x].dist)
		if(d.offset > dm[d.y+1][d.x].dist){
			state.exec_drop = d
			return dm[d.y+1][d.x].initial_move
		}
	}
	console.error("no drop")
	return false
}




function all_drops(world){
	let drops = []
	for(let y=0; y<world.height; ++y){
		for(let x=0; x<world.width; ++x){
			if((world.map[y][x] == '*' || world.map[y][x] == 'O') && world.map[y+1][x] == ':'){
				drops.push({move: 'd', route: build_drop_route(world, x, y+1), x, y})
			}else if(world.map[y][x] == 'O' && world.map[y][x+1] == ' ' && ': '.includes(world.map[y][x-1])){
				drops.push({move: 'r', route: build_drop_route(world, x+1, y), x, y})
			}else if(world.map[y][x] == 'O' && world.map[y][x-1] == ' ' && ': '.includes(world.map[y][x+1])){
				drops.push({move: 'l', route: build_drop_route(world, x-1, y), x, y})
			}
		}
	}
	return drops.filter(function(x){return x.route.length > 2})
}


function build_drop_route(world, x, y){
	let route = []
	let dir = ''
	do{
		dir = fall_direction(world, x, y)
		route.push(x)
		route.push(y)
		if(dir == 'v'){
			y++
		}else if(dir == '>'){
			x++
		}else if(dir == '<'){
			x--
		}
	}while(!'_$'.includes(dir))
	return route
}


function build_distance_map(world, state){
	let player_pos = world.player_pos();
	let visited = create_2d_array(world.width, world.height, function(x, y){
		return {dist: Infinity, initial_move: ' '};
	});
	let moves = new Heap();
	let {x, y} = player_pos;
	let good_moves = state.good_moves;
	if(good_moves.includes('l'))
		moves.push({initial_move: 'l', x: x-1, y: y}, 1);
	if(good_moves.includes('r'))
		moves.push({initial_move: 'r', x: x+1, y: y}, 1);
	if(good_moves.includes('u'))
		moves.push({initial_move: 'u', x: x, y: y-1}, 1);
	if(good_moves.includes('d'))
		moves.push({initial_move: 'd', x: x, y: y+1}, 1);

	while(!moves.empty()){
		let {elem: move, priority: distance} = moves.pop()
		let {x, y} = move
		if(visited[y][x].dist <= distance){
			continue
		}
		if(' :'.includes(world.map[y][x])){
			visited[y][x].dist = distance
			visited[y][x].initial_move = move.initial_move

			moves.push({initial_move: move.initial_move, x: x-1, y: y}, distance+1);
			moves.push({initial_move: move.initial_move, x: x+1, y: y}, distance+1);
			moves.push({initial_move: move.initial_move, x: x, y: y-1}, distance+1);
			moves.push({initial_move: move.initial_move, x: x, y: y+1}, distance+1);
		}
	}

	return visited
}


function short_route(route){
	for(let i=1; i<route.length; ++i){
		if(pos_eq(route[0], route[i]) && route[0].dir == route[i].dir){
			return true
		}
	}
	return false
}

function pos_eq(p1, p2){
	return p1.x == p2.x && p1.y == p2.y
}


// old function
function try_to_kill(world, state){
	let player_pos = state.pos;
	let visited = create_2d_array(world.width, world.height, function(x, y){
		return Infinity;
	});

	let moves = new Heap();
	let {x, y} = player_pos;
	let good_moves = state.good_moves;
	if(good_moves.includes('l'))
		moves.push({initial_move: 'l', x: x-1, y: y, prev_move: 'l'}, 1);
	if(good_moves.includes('r'))
		moves.push({initial_move: 'r', x: x+1, y: y, prev_move: 'r'}, 1);
	if(good_moves.includes('u'))
		moves.push({initial_move: 'u', x: x, y: y-1, prev_move: 'u'}, 1);
	if(good_moves.includes('d'))
		moves.push({initial_move: 'd', x: x, y: y+1, prev_move: 'd'}, 1);

	search_for_butterfly = Math.random() < config.butterfly_chase_probability ? true: false;

	//if(Math.random() < config.yolo_probability){
	//	return good_moves[Math.floor(Math.random()*good_moves.length)]
	//}

	while(!moves.empty()){
		let {elem: move, priority} = moves.pop();
		let {initial_move, x, y} = move;
		if(world.map[y][x] == '*' || world.map[y][x] == '@'){
			continue
		}
		if(visited[y][x] <= priority){
			continue;
		}
		visited[y][x] = priority;
		if(search_for_butterfly){
			//&& y+3 < world.height && '<>v^'.includes(world.map[y+3][x])){
			for(let i=0; i>state.routes.length; ++i){
				let pos = state.routes[i][state.routes[i].length-1]
				if(priority < state.routes[i].length){
					pos = state.routes[i][Math.floor(priority)]
				}
				if(pos.x == x && pos.y == y+3){
					return initial_move
				}
			}
		}else if(!search_for_butterfly && ':' == world.map[y][x]){
			return initial_move;
		}else if(' :'.includes(world.map[y][x])){
			if(world.map[y-1][x] == 'O'){
				priority+=config.rock_drop_weight;
			}
			function push_move(move){
				let {x:nx, y:ny} = move_pos({x, y}, move)
				let bad = 0;
				let add = 1
				/*if(state.dead_end_graph.is_dead_end(x, y)){
					add += config.dead_end_weight;
				}*/
				if(state.mark_bad[y][x].expire > world.frame){
					bad = state.mark_bad[y][x].value
				}
				moves.push({initial_move, x: nx, y: ny}, priority + add + bad)
			}

			push_move('l');
			push_move('r');
			push_move('u');
			push_move('d');
		}
	}

	if(search_for_butterfly){
		while(!moves.empty()){
			let {elem: move, priority} = moves.pop();
			let {initial_move, x, y} = move;
			if(visited[y][x] <= priority){
				continue;
			}
			if('*@'.includes(world.map[y][x])){
				continue
			}
			visited[y][x] = priority;
			if(search_for_butterfly && '<>v^'.includes(world.map[y][x])){
				return initial_move;
			}else if(!search_for_butterfly && ':' == world.map[y][x]){
				return initial_move;
			}else if(' :'.includes(world.map[y][x])){
				moves.push({initial_move, x: x-1, y: y}, priority+1);
				moves.push({initial_move, x: x+1, y: y}, priority+1);
				moves.push({initial_move, x: x, y: y-1}, priority+1);
				moves.push({initial_move, x: x, y: y+1}, priority+1);
			}
		}
	}
	console.error('NOTHING')
	if(good_moves.length > 0){
		return good_moves[Math.floor(Math.random()*good_moves.length)]
	}else if(state.alive_move.length > 0){
		console.error("ALIVEEE")
		return state.alive_move[Math.floor(Math.random()*state.alive_move.length)]
	}else{
		console.error("PANIC");
		return ' '
		return 'lrud '[Math.floor(Math.random()*5)]
	}
}


function ban_dead_moves(world, state){
	let moves = []
	let alive = []
	evalute_all_around(world, 4, function(w, move){
		let tree = world_line_tree(w, 2);
		tree.move = move
		if(is_alive(tree)){
			alive.push(move)
			if(is_free(tree)){
				moves.push(move)
			}
		}
	})
	return {good: moves, alive: alive}
}


function err_tree(tree){
	console.error(tree.world.map)
	console.error(tree.move)
	console.error("CHILDREN OPEN")
	for(let c of tree.children){
		err_tree(c)
	}
	console.error("CHILDREN CLOSE")
}


function world_line_tree(world, depth){
	let res = []
	for(let move of ['r', 'u', 'l', 'd']){
		let w = world.clone();
		w.evalute(move)
		let obj = {world: w, move, children: []}
		if(depth > 1 && !w.dead){
			obj = world_line_tree(w, depth-1)
			obj.move = move
		}
		res.push(obj)
	}
	return {world, children: res, move: ' '}
}


function is_alive(world_tree){
	let {world, children} = world_tree;
	let {x, y} = world.player_pos()
	let but_neig = [world.map[y-1][x], world.map[y+1][x], world.map[y][x-1], world.map[y, x+1]].some(function(e){
		return '<>^v'.includes(e)
	})
	return !world.dead && !but_neig && (children.length == 0 || children.some(is_alive))
}

function is_free(world_tree_node){
	let {world, children} = world_tree_node;
	let res = ((children.length == 0) || children.some(function(x){
		let p = world.player_pos();
		let pp = x.world.player_pos()
		let cmp_pos = (p.x != pp.x || p.y != pp.y)
		let res = (p.x != pp.x || p.y != pp.y) || (x.children.length != 0 && is_free(x))
		return res;
	}))
	return res;
}


function evalute_all_around(world, dist, func){
	let rect = around_rect(world, dist)
	for(let move of ['r', 'u', 'l', 'd']){
		let w = world.partial_copy(rect);
		w.evalute(move)
		func(w, move)
	}
}

function around_rect(world, dist){
	let pp = world.player_pos();
	let rect = {x1: pp.x-dist, x2: pp.x+dist, y1: pp.y-dist, y2: pp.y+dist}
	if(rect.x1 < 1)
		rect.x1 = 1
	if(rect.x2 >= world.width)
		rect.x2 = world.width - 1
	if(rect.y1 < 1)
		rect.y1 = 1
	if(rect.y2 >= world.height)
		rect.y2 = world.height - 1

	return rect
}


function is_butterfly_neighbor(routes, pos, distance){
	let {x, y} = pos;
	for(let r of routes){
		if(r.length > distance && Math.abs(x - r[distance].x) + Math.abs(y - r[distance].y) < 2)
			return true;
	}
	return false
}


function get_butterfly_routes(world, depth){
	let butterflies = []
	for(let y=0; y<world.height; ++y){
		for(let x=0; x<world.width; ++x){
			if('v<>^'.includes(world.map[y][x]))
				butterflies.push({x, y});
		}
	}

	let routes = butterflies.map(function(pos){
		return build_butterfly_route(world, pos, depth);
	})
	
	return routes
}


function is_butterfly_killed(world){
	let depth = config.butterfly_kill_depth;
	let routes = get_butterfly_routes(world, depth);

	let fall_map = build_fall_map(world);
	for(let r of routes){
		for(let i=0; i<depth; ++i){
			let anc = all_fall_ancestors(fall_map, r[i], depth-i);
			if(anc.some(function(e){
				return '@0'.includes(world.map[e.y][e.x]) && e.depth == i+1;
			})){
				return true
			}
		}
	}
	return false
}


function all_fall_ancestors(fall_map, pos, depth){
	let queue = new Heap();
	let all = []
	queue.push(pos, 0);
	while(!queue.empty()){
		let {elem: pos, priority:dep} = queue.pop();
		if(dep > depth){
			break;
		}else{
			visit_fall_ancestors(fall_map, pos, function(x, y){
				queue.push({x, y}, dep+1);
				all.push({x, y, depth:dep+1});
			});
		}
	}
	return all
}


function visit_fall_ancestors(fall_map, pos, func){
	let {x, y} = pos;
	if(fall_map[y-1][x] == 'v'){
		func(x, y-1)
	}
	if(fall_map[y][x-1] == '>'){
		func(x-1, y)
	}
	if(fall_map[y][x+1] == '<'){
		func(x+1, y)
	}
}


function build_fall_map(world){
	return create_2d_array(world.width, world.height, function(x, y){
		if(x >= 1 && x < world.width-1 && y > 0 && y < world.height-1){
			return fall_direction(world, x, y)
		}else{
			return '$'
		}
	});
}


function fall_direction(world, x, y){
	let empty = ' ^v<>A0@'
	if(empty.includes(world.map[y+1][x])){
		return 'v'
	}else if('*O+'.includes(world.map[y+1][x])){
		if(empty.includes(world.map[y][x-1]) && empty.includes(world.map[y+1][x-1])){
			return '<'
		}else if(empty.includes(world.map[y][x+1]) && empty.includes(world.map[y+1][x+1])){
			return '>'
		}else{
			return '_'
		}
	}else{
		return '$'
	}
}


function build_butterfly_route(world, butterfly_pos, len){
	let route = []
	let {x, y} = butterfly_pos;
	let dir = {'^': 0, '>': 1, 'v': 2, '<': 3}[world.map[y][x]];
	for(let i=0; i<len; ++i){
		route.push({x, y, dir});
		let pos = [{x, y:y-1}, {x:x+1, y}, {x, y:y+1}, {x:x-1, y}];
		let neig = [world.map[y-1][x], world.map[y][x+1], world.map[y+1][x], world.map[y][x-1]];
		let next_dir = (dir+3)%4;
		if(' @0A<>v^'.includes(neig[next_dir])){
			dir = next_dir;
			x = pos[next_dir].x
			y = pos[next_dir].y
		}else if(' @0A<>v^'.includes(neig[dir])){
			x = pos[dir].x
			y = pos[dir].y
		}else{
			next_dir  = (dir+1)%4;
			dir = next_dir
		}
	}
	return route
}


////////////////////////////////////////////////
// Distance Graph

class DistanceGraph{
	constructor(diamonds){
		this.nodes = diamonds.map(function(pos){return {pos, neighbors: []}});
		for(let j in this.nodes){
			for(let i=0; i<diamonds.length; ++i){
				let n = this.nodes[j]
				if(i != j){
					let d = diamonds[i]
					if(Math.abs(n.pos.x - d.x) + Math.abs(n.pos.y - d.y) <= config.graph_max_distance){
						n.neighbors.push(i)
					}
				}
			}
		}

		this.joints = determine_joints(this);
	}


	get_joint_scopes(joint_id){
		let visited = this.nodes.map(function(node){
			return false;
		});
		visited[joint_id] = true;
		let obj = this
		return this.nodes[joint_id].neighbors.map(function(node){
			return {node, size: obj.children_count(visited, node)+1}
		})
	}

	children_count(visited, node){
		visited[node] = true;
		let acc = 0;
		for(let n of this.nodes[node].neighbors){
			if(!visited[n]){
				acc += this.children_count(visited, n) + 1
			}
		}
		return acc;
	}
}


class DeadEndGraph{
	constructor(map){
		this.map = map
		this.nodes = new Array(map.length * map[0].length);
		for(let y=0; y<map.length; ++y){
			for(let x=0; x<map[0].length; ++x){
				let neighbors = []
				if(!'O#+'.includes(map[y][x])){
					if(x > 1 && !'O#+'.includes(map[y][x-1]))
						neighbors.push(this.node_id(x-1, y))
					if(x < map[0].length - 1 && !'O#+'.includes(map[y][x+1]))
						neighbors.push(this.node_id(x+1, y))
					if(y > 1 && !'O#+'.includes(map[y-1][x]))
						neighbors.push(this.node_id(x, y-1))
					if(y < map.length - 1 && !'O#+'.includes(map[y+1][x]))
						neighbors.push(this.node_id(x, y+1))
				}
				this.nodes[this.node_id(x, y)] = {neighbors}
			}
		}

		this.joints = determine_joints(this)
	}

	node_id(x, y){
		return this.map[0].length * y + x
	}

	is_dead_end(x, y){
		return this.joints[this.node_id(x, y)]
	}
}


function determine_joints(graph){
	return new DetermineJoints(graph).joints();
}


class DetermineJoints{
	constructor(graph){
		this.graph = graph;
		this.visited = graph.nodes.map(function(){return false;});
		this.d = new Array(graph.nodes.length);
		this.l = new Array(graph.nodes.length);
	}

	joints(){
		let d = this.d
		let l = this.l
		let joints = new Array(this.graph.nodes.length)
		for(let i=0; i<this.visited.length; ++i){
			if(this.visited[i] == false){
				this.count = this.mark_nodes(i, 0);
				joints[i] = this.count >= 2;
			}else{
				joints[i] = null;
			}
		}
		for(let i=1; i<this.graph.nodes.length; ++i){
			if(joints[i] == null){
				joints[i] = this.graph.nodes[i].neighbors.some(function(n){
					return d[i] <= l[n];
				});
			}
		}
		return joints;
	}

	mark_nodes(start, depth){
		let count = 0;
		if(!this.visited[start]){
			this.visited[start] = true;
			this.d[start] = depth;
			let l = depth;
			for(let n of this.graph.nodes[start].neighbors){
				if(this.d[n] + 1 == depth)
					continue;
				let v = this.visited[n]
				if(!v){
					count++;
				}
				this.mark_nodes(n, depth+1);
				if(this.d[n] <= l){
					l = this.d[n];
				}
				if(!v && this.l[n] <= l){
					l = this.l[n];
				}
			}
			this.l[start] = l;
		}
		return count;
	}
}


////////////////////////////////////////////////
// Game simulation clone

class World{
	constructor(map){
		this.create_map(map);
		this.frame = 0;

		this.marked = create_2d_array(this.width, this.height, function(x, y){
			return 0;
		});
		this.score = 0;
		this.streak = 0;
		this.streak_end_frame = 0;
		this.dead = false;

		this.but_count = 0
		for(let y=0; y<this.height; ++y){
			for(let x=0; x<this.width; ++x){
				if(this.map[y][x] == 'A'){
					this.pl_pos = {x, y}
				}else if('<>v^'.includes(this.map[y][x])){
					this.but_count++
				}
			}
		}

	}

	partial_evalute(rect){
		this.frame++;
		for(let y=rect.y1; y<rect.y2; ++y){
			for(let x=rect.x1; x<rect.x2; ++x){
				if(this.marked[y][x] < this.frame){
					let {x: nx, y: ny} = this.evalute_object(x, y, move);
					let obj = this.map[y][x];
					this.map[y][x] = ' ';
					this.map[ny][nx] = obj;
					this.marked[ny][nx] = this.frame
				}
			}
		}
	}


	clone(){
		let w = new World(this.map);
		w.frame = this.frame
		w.score = this.score
		w.streak = this.streak
		w.streak_end_frame = this.streak_end_frame
		return w;
	}

	partial_copy(rect){
		let map = this.map
		let w = new World(create_2d_array(rect.x2-rect.x1+2, rect.y2-rect.y1+2, function(x, y){
			if(x == 0 || x == rect.x2-rect.x1+1 || y == 0 || y == rect.y2-rect.y1+1){
				return '#'
			}else{
				return map[y+rect.y1-1][x+rect.x1-1]
			}
		}));
		return w;
	}

	create_map(map){
		this.width = map[0].length;
		this.height = map.length; // last row contain score


		// clone map
		//
		// since butterflies behavior determined not only
		// by position, but also by directions
		// distinguish butterflies by direction
		// ^<>v; every buterfly start with UP direction
		this.map = map2d(map, function(elem){
			if('-\|/'.includes(elem)){
				return '^'
			}else{
				return elem
			}
		});
	}

	test(map){
		for(let y=0; y<this.height; ++y){
			for(let x=0; x<this.width; ++x){
				let a = map[y][x];
				let b = this.map[y][x];
				if('-\\|/'.includes(a)){
					if(!'v<>^'.includes(b))
						return {x, y};
				}else if(a == 'O'){
					if(!'0O'.includes(b))
						return {x, y};
				}else if(a == '*'){
					if(!'*@12345'.includes(b))
						return {x, y};
				}else if(a != b){
					return {x, y};
				}
			}
		}
		return null;
	}

	player_pos(){
		return this.pl_pos;
	}

	collect_diamond(){
		if(this.frame > this.streak_end_frame){
			this.streak = 0;
		}
		this.streak_end_frame = this.frame + 20;
		this.streak++;
		this.score++;
		if (this.streak<3)
            return;
        if (this.streak==3)
            this.streaks++;
        for (let i = 2; i*i<=this.streak; i++)
        {
            if (this.streak%i==0)
                return;
        }
        // streak is a prime number
        this.score += this.streak;
	}

	evalute(move){
		this.frame++;
		for(let y=0; y<this.height; ++y){
			for(let x=0; x<this.width; ++x){
				if(this.marked[y][x] < this.frame){
					let {x: nx, y: ny} = this.evalute_object(x, y, move);
					let obj = this.map[y][x];
					this.map[y][x] = ' ';
					this.map[ny][nx] = obj;
					this.marked[ny][nx] = this.frame
				}
			}
		}
	}

	evalute_object(x, y, move){
		let obj = this.map[y][x]
		if('0*O@'.includes(obj)){
			return this.evalute_fall(x, y);
		}else if(obj == 'A'){
			let {x:nx, y:ny} = this.evalute_player(x, y, move);
			if('*@'.includes(this.map[ny][nx])){
				this.collect_diamond();
			}
			this.pl_pos = {x:nx, y:ny}
			return {x:nx, y:ny};
		}else if('^<>v'.includes(obj)){
			return this.evalute_butterfly(x, y);
		}if(' :+#'.includes(obj)){
			
		}else if([1, 2, 3, 4, 5].includes(obj)){
			if(obj == 4){
				this.map[y][x] = '*'
			}else{
				this.map[y][x] = obj + 1;
			}
		}
		return {x, y}
	}

	evalute_fall(x, y){
		let obj = this.map[y][x]
		let target = this.map[y+1][x]
		if('+O*'.includes(target)){
			if(this.roll_to(x, y, x-1)){
				return {x: x-1, y}
			}else if(this.roll_to(x, y, x+1)){
				return {x: x+1, y}
			}
		}

		// falling object
		if(target == ' '){
			this.map[y][x] = this.to_falling(this.map[y][x]);
			return {x, y:y+1};
		}else if('@0'.includes(obj) && 'v<>^A'.includes(target)){
			this.map[y][x] = this.from_falling(this.map[y][x]);
			if(target == 'A'){
				this.dead = true;
				this.dead_cause = 'fall'
			}else{
				this.explosion(x, y+1);
			}
			return {x, y};
		}else{
			this.map[y][x] = this.from_falling(this.map[y][x]);
			return {x, y}
		}
	}
	
	explosion(x, y){
		this.but_count--
		console.log({x, y})
		this.map[y][x] = 1
		this.marked[y][x] = this.frame
		for(let i=y-1; i<y+2; ++i){
			for(let j=x-1; j<x+2; ++j){
				if(this.map[i][j] == 'A'){
					this.dead = true;
					this.dead_cause = 'explosion'
				}else if('v<>^'.includes(this.map[i][j])){
					this.explosion(j, i);
				}else if(this.map[i][j] != '#'){
					this.map[i][j] = 1
					this.marked[i][j] = this.frame
				}
			}
		}
	}

	roll_to(x, y, nx){
		if(this.map[y][nx] == ' ' && this.map[y+1][nx] == ' '){
			this.map[y][x] = this.to_falling(this.map[y][x]);
			return true;
		}else{
			return false;
		}
	}

	to_falling(obj){
		if(obj == 'O'){
			return '0'
		}else if(obj == '*'){
			return '@'
		}else{
			return obj;
		}
	}

	from_falling(obj){
		if(obj == '0'){
			return 'O'
		}else if(obj == '@'){
			return '*'
		}else{
			return obj;
		}
	}

	evalute_player(x, y, move){
		if(move == 'u'){
			if(' :*@'.includes(this.map[y-1][x])){
				return {x, y:y-1};
			}else{
				return {x, y};
			}
		}else if(move == 'd'){
			if(' :*@'.includes(this.map[y+1][x])){
				return {x, y:y+1};
			}else{
				return {x, y};
			}
		}else if(move == 'l'){
			if(x>=2 && this.map[y][x-1] == 'O' && this.map[y][x-2] == ' '){
				this.map[y][x-2] = 'O';
				this.marked[y][x-2] = this.marked[y][x-1];
				return {x:x-1, y};
			}else if(' :*@'.includes(this.map[y][x-1])){
				return {x:x-1, y};
			}else{
				return {x, y};
			}
		}else if(move == 'r'){
			if(x<this.width-2 && this.map[y][x+1] == 'O' && this.map[y][x+2] == ' '){
				this.map[y][x+2] = 'O';
				this.marked[y][x+2] = this.marked[y][x+1];
				return {x:x+1, y};
			}else if(' :*@'.includes(this.map[y][x+1])){
				return {x:x+1, y};
			}else{
				return {x, y};
			}
		}else{
			return {x, y}
		}
	}

	evalute_butterfly(x, y){
		let neig = [this.map[y-1][x], this.map[y][x+1], this.map[y+1][x], this.map[y][x-1]];
		if(neig.includes('A') || neig.every(function(e){return e != ' '})){
			this.explosion(x, y);
			return {x, y};
		}else{
			let dir = {'^': 0, '>': 1, 'v': 2, '<': 3}[this.map[y][x]];
			let redir = ['^', '>', 'v', '<'];
			let pos = [{x, y:y-1}, {x:x+1, y}, {x, y:y+1}, {x:x-1, y}];
			let next_dir = (dir+3)%4;
			if(neig[next_dir] == ' '){
				this.map[y][x] = redir[next_dir]
				return pos[next_dir]
			}else if(neig[dir] == ' '){
				return pos[dir]
			}else{
				next_dir  = (dir+1)%4;
				this.map[y][x] = redir[next_dir]
				return {x, y}
			}
		}
	}
}


// filler is function(x, y)->element
function create_2d_array(width, height, filler){
	array = new Array(height);
	for(let y=0; y<height; y++){
		array[y] = new Array(width);
		for(let x=0; x<width; x++){
			array[y][x] = filler(x, y)
		}
	}
	return array;
}

function map2d(arr, func){
	return create_2d_array(arr[0].length, arr.length, function(x, y){
		return func(arr[y][x], x, y);
	});
}


class Heap{
	constructor(){
		this.data = []
	}

	father(id){
		return Math.floor((id-1)/2);
	}

	left(id){
		return id*2 + 1
	}

	right(id){
		return id*2 + 2
	}

	empty(){
		return this.data.length == 0;
	}

	push(elem, priority){
		this.data.push({elem, priority});
		if(!this.empty()){
			this.rotate_up(this.data.length - 1);
		}
	}

	rotate_up(id){
		if(id == 0)
			return

		let fid = this.father(id);
		let f = this.data[fid]
		let c = this.data[id]
		if(f.priority > c.priority){
			this.data[fid] = c
			this.data[id] = f
			this.rotate_up(fid)
		}
	}

	pop(){
		if(this.data.length == 1){
			return this.data.pop()
		}else{
			let e = this.data[0];
			this.data[0] = this.data.pop()
			this.rotate_down(0)
			return e
		}
	}

	rotate_down(id){
		if(this.left(id) >= this.data.length){
			return;
		}else if(this.right(id) >= this.data.length){
			let lid = this.left(id);
			let f = this.data[id]
			let l = this.data[lid]

			if(l.priority < f.priority){
				this.data[id] = l
				this.data[lid] = f
				this.rotate_down(lid)
			}
		}else{
			let lid = this.left(id);
			let rid = this.right(id);
			let f = this.data[id]
			let l = this.data[lid]
			let r = this.data[rid]
			if(r.priority < l.priority){
				if(r.priority < f.priority){
					this.data[id] = r
					this.data[rid] = f
					this.rotate_down(rid)
				}
			}else{
				if(l.priority < f.priority){
					this.data[id] = l
					this.data[lid] = f
					this.rotate_down(lid)
				}
			}
		}
	}
}

