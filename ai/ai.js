config = {
	butterfly_chase_probability: 0.90,
	yolo_probability: 0.05,
	rock_drop_weight: 3,
	butterfly_near_weight: 10,
	dirt_eat_weight: -0.05
}


exports.play = function*(screen){
	let world = new World(screen.slice(0, -1));
	let err = 0;
	world.evalute(' ');
	yield ' '
	while(true){
		test = world.test(screen);
		if(test != null){
			let {x, y} = test;
			yield "q";
		}
		let command = determine_action(world);
		world.evalute(command);
		if(world.dead){
			yield "q";
		}
		yield command
	}
}


function determine_action(world){
	return path_find(world, world.player_pos());
}


function ban_dead_moves(world){
	let moves = []
	evalute_all_around(world, 4, function(world, move){
		if(is_alive_and_free(world, 3)){
			moves.push(move);
		}
	})
	return moves
}


function is_alive_and_free(world, depth){
	if(!world.dead){
		if(depth == 0)
			return true

		let pp = world.player_pos();
		let certain_death = true;
		let stuck = true;
		evalute_all_around(world, depth*2, function(world, move){
			if(is_alive_and_free(world, depth-1))
				certain_death = false
			if(pp != world.player_pos())
				stuck = false;
		});
		return !(certain_death || stuck);
	}else{
		return false;
	}
}


function evalute_all_around(world, dist, func){
	let pp = world.player_pos();
	let rect = {x1: pp.x-dist, x2: pp.x+dist, y1: pp.y-dist, y2: pp.y+dist}
	if(rect.x1 < 0)
		rect.x1 = 0
	if(rect.x2 >= world.width)
		rect.x2 = world.width - 1
	if(rect.y1 < 0)
		rect.y1 = 0
	if(rect.y2 >= world.height)
		rect.y2 = world.height - 1

	for(let move of ['r', 'u', 'l', 'd']){
		let w = world.partial_copy(rect);
		w.evalute(move)
		func(w, move)
	}
}


function path_find(world, player_pos){
	let visited = create_2d_array(world.width, world.height, function(x, y){
		return Infinity;
	});

	let moves = new Heap();
	let {x, y} = player_pos;
	let good_moves = ban_dead_moves(world);
	if(good_moves.includes('l'))
		moves.push({initial_move: 'l', x: x-1, y: y}, 1);
	if(good_moves.includes('r'))
		moves.push({initial_move: 'r', x: x+1, y: y}, 1);
	if(good_moves.includes('u'))
		moves.push({initial_move: 'u', x: x, y: y-1}, 1);
	if(good_moves.includes('d'))
		moves.push({initial_move: 'd', x: x, y: y+1}, 1);

	if(Math.random() > 1 - config.yolo_probability){
		return good_moves[Math.floor(Math.random()*good_moves.length)]
	}

	while(!moves.empty()){
		let {elem: move, priority} = moves.pop();
		let {initial_move, x, y} = move;
		if(visited[y][x] <= priority){
			continue;
		}
		visited[y][x] = priority;
		if('*@'.includes(world.map[y][x])){
			return initial_move;
		}else if(' :'.includes(world.map[y][x])){
			if(world.map[y-1][x] == 'O'){
				priority+=config.rock_drop_weight;
			}
			if(is_butterfly_neighbor(world, {x, y})){
				priority+=config.butterfly_near_weight;
			}
			let add = 1;
			if(world.map[y][x] == ':'){
				add = 1 + config.dirt_eat_weight;
			}

			moves.push({initial_move, x: x-1, y: y}, priority+add);
			moves.push({initial_move, x: x+1, y: y}, priority+add);
			moves.push({initial_move, x: x, y: y-1}, priority+add);
			moves.push({initial_move, x: x, y: y+1}, priority+add);
		}
	}

	if(good_moves.includes('l'))
		moves.push({initial_move: 'l', x: x-1, y: y}, 1);
	if(good_moves.includes('r'))
		moves.push({initial_move: 'r', x: x+1, y: y}, 1);
	if(good_moves.includes('u'))
		moves.push({initial_move: 'u', x: x, y: y-1}, 1);
	if(good_moves.includes('d'))
		moves.push({initial_move: 'd', x: x, y: y+1}, 1);
	visited = create_2d_array(world.width, world.height, function(x, y){
		return Infinity;
	})

	state = Math.random() > config.butterfly_chase_probability ? '^v<>': ':';

	while(!moves.empty()){
		let {elem: move, priority} = moves.pop();
		let {initial_move, x, y} = move;
		if(visited[y][x] <= priority){
			continue;
		}
		visited[y][x] = priority;
		if(state.includes(world.map[y][x])){
			return initial_move;
		}else if(' :'.includes(world.map[y][x])){
			if(world.map[y-1][x] == 'O'){
				priority+=3;
			}
			if(is_butterfly_neighbor(world, {x, y})){
				priority+=10;
			}

			moves.push({initial_move, x: x-1, y: y}, priority+1);
			moves.push({initial_move, x: x+1, y: y}, priority+1);
			moves.push({initial_move, x: x, y: y-1}, priority+1);
			moves.push({initial_move, x: x, y: y+1}, priority+1);
		}
	}

	if(good_moves.length > 0){
		return good_moves[Math.floor(Math.random()*good_moves.length)]
	}else{
		return 'panic move'
	}
}


function is_butterfly_neighbor(world, pos){
	let {x, y} = pos;
	return '^v<>'.includes(world.map[y-1][x])
			|| '^v<>'.includes(world.map[y+1][x])
			|| '^v<>'.includes(world.map[y-1][x])
			|| '^v<>'.includes(world.map[y][x+1])
			|| '^v<>'.includes(world.map[y][x-1])
			|| '^v<>'.includes(world.map[y][x])
}


function is_butterfly_killed(world){
	let depth = 5;

	let fall_map = build_fall_map(world);
	let butterflies = []
	for(let y=0; y<world.height; ++y){
		for(let x=0; x<world.width; ++x){
			if('v<>^'.includes(world.map[y][x]))
				butterflies.push({x, y});
		}
	}

	let routes = butterflies.map(function(pos){
		return build_butterfly_route(world, pos, 5);
	})

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
	let empty = ' ^v<>A0@'
	return create_2d_array(world.width, world.height, function(x, y){
		if(!empty.includes(world.map[y][x])){
			return ' '
		}else if(empty.includes(world.map[y+1][x])){
			return 'v'
		}else if(empty.includes(world.map[y][x-1] && empty.includes(world.map[y+1][x-1] && '*O+'.includes(world.map[y][x])))){
			return '<'
		}else if(empty.includes(world.map[y][x+1] && empty.includes(world.map[y+1][x+1] && '*O+'.includes(world.map[y][x])))){
			return '>'
		}else{
			return ' '
		}
	});
}


function build_butterfly_route(world, butterfly_pos, len){
	let route = []
	let {x, y} = butterfly_pos;
	let dir = {'^': 0, '>': 1, 'v': 2, '<': 3}[world.map[y][x]];
	for(let i=0; i<len; ++i){
		route.push({x, y});
		let pos = [{x, y:y-1}, {x:x+1, y}, {x, y:y+1}, {x:x-1, y}];
		let neig = [world.map[y-1][x], world.map[y][x+1], world.map[y+1][x], world.map[y][x-1]];
		let next_dir = (dir+3)%4;
		if(neig[next_dir] == ' '){
			dir = next_dir;
			x = pos[next_dir].x
			y = pos[next_dir].y
		}else if(neig[dir] == ' '){
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

		for(let y=0; y<this.height; ++y){
			for(let x=0; x<this.width; ++x){
				if(this.map[y][x] == 'A'){
					this.pl_pos = {x, y}
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
		console.log({x, y})
		this.map[y][x] = 1
		this.marked[y][x] = this.frame
		for(let i=y-1; i<y+2; ++i){
			for(let j=x-1; j<x+2; ++j){
				if(this.map[i][j] == 'A'){
					this.dead = true;
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



