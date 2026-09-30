import { system, world, ItemStack } from "@minecraft/server";
import { getMapPixel } from "./minimap";
import { Vector } from "./lib/Vector3";

export let Dimensions = [
    "minecraft:overworld",
    "minecraft:the_end",
    "minecraft:nether"
];

var renderCache = [];
let minimap_owner = {};
let player_atlas_entity = {};
let player_atlas_data = {};
let player_is_rendering_atlas = {};

export function playerOpenAtlasMap(player){
    return player_atlas_data[player.id] != undefined;
}

let renderEntityCahce = {};

function renderPlayerMinimap(id, dimension, playerPos){
    if(player_atlas_data[id] == undefined) player_atlas_data[id] = {
        offset: { x: 0, y: 0 },
        zoom: 3.0
    };
    renderEntityCahce[id] = {};
    let entities = dimension.getEntities({ type: "minecraft:player" });
    for(let entity of entities){
        let relative = Vector.subtract(entity.location, playerPos);
        let temp_x = relative.x * (1 / player_atlas_data[id].zoom);
        let temp_z = relative.z * (1 / player_atlas_data[id].zoom);
        let pixel = new Vector(temp_x, 0, temp_z).round();
        renderEntityCahce[id][pixel.toString()] = "羅";
        renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: 0}).toString()] = "羅";
        renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: 0}).toString()] = "羅";
        renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: 1}).toString()] = "羅";
        renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: -1}).toString()] = "羅";
        renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: 1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: 1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: -1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: -1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 2, y: 0, z: 0}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: -2, y: 0, z: 0}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: 2}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: -2}).toString()] = "";
    };
}

function* renderMapAtlas(id, dimension, target, location, initial = true){
    if(renderCache[id] == undefined){
        renderCache[id] = [];
        for(let x = -86; x <= 86; x++){
            let buffer = [];
            for(let y = -44; y <= 44; y++){
                buffer.push("");
            }
            renderCache[id].push(buffer);
        }
    }
    yield;

    renderPlayerMinimap(id, dimension, { x: location.x + player_atlas_data[id].offset.x, z: location.z + player_atlas_data[id].offset.y, y: location.y});

    for(let y = -44; y <= 44; y++){
        for(let x = -86; x <= 86; x++){
            let radar = new Vector(x, 0, y).round().toString();
            if(renderEntityCahce[id] && renderEntityCahce[id][radar] != undefined){
                renderCache[id][x+86][y+44] = renderEntityCahce[id][radar];
                continue;
            }
            let target = new Vector(x*player_atlas_data[id].zoom + location.x + player_atlas_data[id].offset.x, 320, y*player_atlas_data[id].zoom + location.z + player_atlas_data[id].offset.y);
            // if(Math.random() < 0.1) console.warn(target.toString())
            renderCache[id][x+86][y+44] = yield* getMapPixel(dimension, target);
            yield;
        }
    }
    if(initial || system.currentTick % 30 > 15) system.runTimeout(() => renderMapAtlasUI(id, target), 1);
    
    delete player_is_rendering_atlas[id];
}

async function renderMapAtlasUI(id, entity){
    var start = system.currentTick;
    let renderer = renderCache[id];
    let counter = 0;
    if(renderer != undefined && entity.isValid){
        try {
            let container = entity.getComponent("minecraft:inventory").container;
            for(let y = 0; y < 88; y++){
                if(counter % 3 == 0) await system.waitTicks(1);
                let c = 0;
                let pixel_chunk = [];
                let pixel = "§r";
                for(let x = 0; x < 173; x++){
                    pixel += renderCache[id][x][y];
                    if(c >= 13){
                        pixel_chunk.push(pixel);
                        pixel = "§r";
                        c = 0;
                    }
                    c++;
                }
                
                let chunk = new ItemStack("mmap:map_placeholder");
                chunk.nameTag = "§r";
                chunk.setLore(pixel_chunk);
                container.setItem(y, chunk);
                counter++;
            }
        }catch(error){
            console.warn("[Magnificent Minimap] cannot finish render atlas:", error);
        }
    }
    // console.warn("FINISHED", system.currentTick - start)
}

function setupAtlasUtil(entity){
    let container = entity.getComponent("minecraft:inventory").container;
    for(let i = 88; i < 95; i++){
        let chunk = new ItemStack("mmap:map_placeholder");
        chunk.nameTag = "§r" + i;
        container.setItem(i, chunk);
    }
}

world.afterEvents.entitySpawn.subscribe(s =>{
    if(s.entity.isValid && s.entity.typeId == "minecraft:item" && s.entity.getComponent("minecraft:item")?.itemStack?.typeId == "mmap:map_placeholder"){
        s.entity.remove();
    }
})

world.afterEvents.playerInventoryItemChange.subscribe(s =>{
    s.player.getComponent("minecraft:inventory").container.setItem(s.slot);
}, { includeItems: [ "mmap:map_placeholder" ]})

world.afterEvents.playerInteractWithEntity.subscribe(s =>{
    if(s.target.typeId == "mmap:atlas_map_container"){
        system.runJob(renderMapAtlas(s.player.id, s.target.dimension, s.target, s.player.location));
        player_atlas_data[s.player.id] = {
            offset: { x: 0, y: 0 },
            zoom: 3.0
        };
        s.target.setProperty("mmap:open_inv", true);
    }
})

system.runInterval(() =>{
    world.getPlayers().forEach(playerData =>{
        if(player_atlas_entity[playerData.id]?.isValid == false){
            delete renderCache[playerData.id];
            delete player_atlas_entity[playerData.id];
            delete player_atlas_data[playerData.id];
            delete minimap_owner[player_atlas_entity[playerData.id].id];
        }
        if(!playerData.dimension.isChunkLoaded(playerData.location)) return;
        let equippable = playerData.getComponent("minecraft:equippable");
        let mainhand = equippable.getEquipment("Mainhand");
        if(mainhand?.typeId == "mmap:map_atlas" && player_atlas_entity[playerData.id] == undefined){
            let entity = playerData.dimension.spawnEntity("mmap:atlas_map_container", playerData.getHeadLocation());
            setupAtlasUtil(entity);
            entity.nameTag = "d7e5-4a9a-be1f";
            entity.getComponent("minecraft:tameable").tame(playerData);
            player_atlas_entity[playerData.id] = entity;
            minimap_owner[entity.id] = playerData;
        }else{
            if(player_atlas_entity[playerData.id] && mainhand?.typeId != "mmap:map_atlas"){
                player_atlas_entity[playerData.id].remove();
                delete player_atlas_entity[playerData.id];
            }else if(player_atlas_entity[playerData.id] && mainhand?.typeId == "mmap:map_atlas"){
                player_atlas_entity[playerData.id].teleport(playerData.getHeadLocation());
            }
        }
    })
})

system.runInterval(() =>{
    Dimensions.forEach(dimension_id =>{
        world.getDimension(dimension_id).getEntities({type: "mmap:atlas_map_container"}).forEach(entity =>{
            if(minimap_owner[entity.id] == undefined){
                entity.remove();
                return;
            }else{
                if(player_atlas_data[minimap_owner[entity.id].id] != undefined){
                    let opening_inv = entity.getProperty("mmap:open_inv");
                    if(!opening_inv || minimap_owner[entity.id]?.isValid == false){
                        delete renderCache[minimap_owner[entity.id].id];
                        delete player_atlas_entity[minimap_owner[entity.id].id];
                        delete player_atlas_data[minimap_owner[entity.id].id];
                        delete minimap_owner[entity.id];
                        entity.remove();
                    }else{
                        // if(player_is_rendering_atlas[minimap_owner[entity.id].id] != undefined){
                        //     setupAtlasUtil(entity);
                        // }else{
                            let container = entity.getComponent("minecraft:inventory").container;
                            let item = [];
                            for(let i = 88; i < 95; i++){
                                item.push(container.getItem(i));
                            }
                            let need_refresh = false;
                            if(item[0] == undefined){
                                player_atlas_data[minimap_owner[entity.id].id].zoom = Math.max(0.2, player_atlas_data[minimap_owner[entity.id].id].zoom - 0.2);
                                need_refresh = true;
                            }
                            if(item[1] == undefined){
                                player_atlas_data[minimap_owner[entity.id].id].zoom = Math.min(8, player_atlas_data[minimap_owner[entity.id].id].zoom + 0.2);
                                need_refresh = true;
                            }
                            if(item[2] == undefined){
                                player_atlas_data[minimap_owner[entity.id].id].offset.x -= 8 * player_atlas_data[minimap_owner[entity.id].id].zoom;
                                need_refresh = true;
                            }
                            if(item[3] == undefined){
                                player_atlas_data[minimap_owner[entity.id].id].offset.x += 8 * player_atlas_data[minimap_owner[entity.id].id].zoom;
                                need_refresh = true;
                            }
                            if(item[4] == undefined){
                                player_atlas_data[minimap_owner[entity.id].id].offset.y -= 8 * player_atlas_data[minimap_owner[entity.id].id].zoom;
                                need_refresh = true;
                            }
                            if(item[5] == undefined){
                                player_atlas_data[minimap_owner[entity.id].id].offset.y += 8 * player_atlas_data[minimap_owner[entity.id].id].zoom;
                                need_refresh = true;
                            }
                            if(item[6] == undefined){
                                player_atlas_data[minimap_owner[entity.id].id] = {
                                    offset: { x: 0, y: 0 },
                                    zoom: 3.0
                                };
                                need_refresh = true;
                            }

                            if(need_refresh){
                                minimap_owner[entity.id].playSound("item.book.page_turn");
                                if(player_is_rendering_atlas[minimap_owner[entity.id].id] != undefined) system.clearJob(player_is_rendering_atlas[minimap_owner[entity.id].id]);
                                player_is_rendering_atlas[minimap_owner[entity.id].id] = system.runJob(renderMapAtlas(minimap_owner[entity.id].id, entity.dimension, entity, minimap_owner[entity.id].location, false));
                                setupAtlasUtil(entity);
                            }
                            if(system.currentTick % 30 == 0) renderMapAtlasUI(minimap_owner[entity.id].id, entity);
                        // }
                    }
                }
            }
        })
    })
})