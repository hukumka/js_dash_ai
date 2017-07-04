exports.play = function(screen){
	while(true){
		yield "l";
	}
}


class WorldSimulation{
	constructor(screen){
		this.reload(screen, 0);
	}

	reload(screen, frame){
		this.frame = frame
		this.screen = cp_screen(screen);
		this.width = screen.length;
		this.height = screen[0].length;
		let {x, y} = find_player(this.screen);
		this.x = x;
		this.y = y;
	}

	evalute(move){
		let marked = create_2d_array(this.width, this.height, false);
		for(let y=0; y<this.height; ++y){
			for(let x=0; x<this.width; ++x){
				if(!marked[y][x]){
					let {nx, ny} = this.evalute_object(x, y, move)
					marked[ny][nx] = true;
					obj = this.screen[y][x]
					this.screen[y][x] = ' '
					this.screen[ny][nx] = obj;
				}
			}
		}
	}

	evalute_object(x, y, move){
		obj = this.screen[y][x];
		if(' :+#'.includes(obj)){
			return {x, y};
		}else if('0*'.includes(obj)){
			return this.evalute_fall(x, y);
		}else if('-\\|/'.includes(obj)){
			return this.
		}
	}
}


function create_2d_array(width, height, element){
	let arr = new Array(height);
	for(let y=0; y<height; ++y){
		let row = new Array(width);
		for(let x=0; x<width; ++x){
			row[x] = element;
		}
		arr[y] = row;
	}
	return arr;
}


function cp_screen(screen){
	let new_screen = new Array(screen.length);
	for(let i=0; i<screen.length; ++i){
		new_screen[i] = screen[i].slice();
	}
	return new_screen;
}


function possible_moves(screen, player){
	moves = '';
	if (' :*'.includes(screen[y-1][x]))
        moves += 'u';
    if (' :*'.includes(screen[y+1][x]))
        moves += 'd';
    if (' :*'.includes(screen[y][x+1])
        || screen[y][x+1]=='O' && screen[y][x+2]==' ')
    {
        moves += 'r';
    }
    if (' :*'.includes(screen[y][x-1])
        || screen[y][x-1]=='O' && screen[y][x-2]==' ')
    {
        moves += 'l';
    }
	return moves;
}


function find_player(screen){
	for(let y=0; y<screen.length; ++y){
		let row = screen[y];
		for(let x = 0; x<row.length; ++x){
			if(row[x] == 'A')
				return {x, y};
		}
	}
}
