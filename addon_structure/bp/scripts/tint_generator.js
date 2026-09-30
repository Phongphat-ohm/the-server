import { BlockTypes, system, world } from "@minecraft/server";

let data = {};
system.run(async () =>{
    let players = world.getPlayers()[0];
    for(let type of BlockTypes.getAll()){
        let loc = players.location;
        loc.y -= 2;
        players.dimension.setBlockType(loc, type.id);
        let block = players.dimension.getBlock(loc);
        if(block) data[block.typeId] = block.getMapColor();
        await system.waitTicks(1);
    }

    console.warn(JSON.stringify(data))
})