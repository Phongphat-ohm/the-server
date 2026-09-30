import { system, world, BlockVolume, BlockTypes, BlockPermutation } from "@minecraft/server";
import { Vector } from "./lib/Vector3";
import { Config } from "./lib/Configuration";
import { BadAppleFrames } from "./lib/Frames";
import { Dimensions, playerOpenAtlasMap } from "./map_atlas";
import { VanillaMapColor } from "./vanilla_map_color";
// let save_counter = 0;
// let load_counter = 0;

const NumToHex = [ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", 'A', 'B', 'C', 'D', 'E', 'F' ];
const BlueHex = [ "EA", "EB", "EC", "ED", "EE", "EF", "F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9" ]; //, "FA", "FB", "FC", "FD", "FE", "FF"
const RotationName = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ[1";
var CharStorage = {};

// for(let r = 0; r < 16; r++){
//     for(let g = 0; g < 16; g++){
//         for(let b = 0; b < 16; b++){
//             let ascii = BlueHex[b] + NumToHex[r] + NumToHex[g];
//             CharStorage[ascii] = String.fromCharCode(parseInt(ascii, 16));
//         }
//     }
// }

function getCharStorage(ascii){
    if(CharStorage[ascii] == undefined) CharStorage[ascii] = String.fromCharCode(parseInt(ascii, 16));
    return CharStorage[ascii];
}

let Grayscale = [];
for(let i = 0; i < 16; i++){
    Grayscale.push(String.fromCharCode(parseInt(BlueHex[i] + NumToHex[i] + NumToHex[i], 16)))
}

let BlockData = {
    "minecraft:overworld": {},
    "minecraft:the_end": {},
    "minecraft:nether": {},
}

let MapPixelData = {
    "minecraft:overworld": {},
    "minecraft:the_end": {},
    "minecraft:nether": {},
}

let PlayerIsGenerating = {};

let compass_direction = [
    {x: -1, z: 0, symbol: ""},
    {x: 1, z: 0, symbol: ""},
    {x: 0, z: 1, symbol: ""},
    {x: 0, z: -1, symbol: ""}
]

var PlayerList = [];

const CONFIG = new Config("magnificent_minimap", "Magnificent Minimap", "textures/ui/magnificent_minimap_pack_icon");
CONFIG.addComponent([
	{
		"name": "Presets",
		"identifier": "magnificent_minimap:presets",
		"type": "dropdown",
		"option": [
			"Custom",
			"Vanilla",
			"Performance",
			"Tilted",
			"Detailed",
			"Magnificent",
            "Radar"
		],
		"value": 0
	},
	{
		"name": "Minimap Zoom Factor",
		"identifier": "magnificent_minimap:zoom",
		"type": "slider",
		"range": [ 1, 40 ],
		"value_step": 1,
		"value": 7
	},
	{
		"name": "Render Minimap",
		"identifier": "magnificent_minimap:render_minimap",
		"type": "toggle",
		"value": true
	},
	{
		"name": "Minimap Tilt",
		"identifier": "magnificent_minimap:minimap_tilt",
		"type": "slider",
		"range": [ 0, 4 ],
		"value_step": 1,
		"value": 0
	},
	{
		"name": "Round Minimap",
		"identifier": "magnificent_minimap:round_minimap",
		"type": "toggle",
		"value": false
	},
	{
		"name": "Enlarge Minimap When Sneak",
		"identifier": "magnificent_minimap:enlarge_minimap",
		"type": "toggle",
		"value": true
	},
	{
		"name": "Minimap Rotation",
		"identifier": "magnificent_minimap:rotate_minimap",
		"type": "toggle",
		"value": false
	},
	{
		"name": "Render Entity",
		"identifier": "magnificent_minimap:render_entity",
		"type": "toggle",
		"value": true
	},
	{
		"name": "Hide Biome Name",
		"identifier": "magnificent_minimap:biome_name",
		"type": "toggle",
		"value": false
	},
	{
		"name": "Minimap FPS",
		"identifier": "magnificent_minimap:minimap_frame_per_second",
		"type": "slider",
		"range": [ 0, 20 ],
		"value_step": 1,
		"value": 5
	},
	{
		"name": "Lower FPS When Move Fast",
		"identifier": "magnificent_minimap:lower_frame_per_second_when_move_fast",
		"type": "toggle",
		"value": true
	},
	{
		"name": "Minimap Render Distance",
		"identifier": "magnificent_minimap:render_distance",
		"type": "slider",
		"range": [ 0, 48 ],
		"value_step": 4,
		"value": 16
	},
	{
		"name": "Minimap Style",
		"identifier": "magnificent_minimap:minimap_style",
		"type": "dropdown",
		"option": [
			"Simple",
			"Vanilla",
			"Modern",
			"Height Map",
			"Magnificent"
		],
		"value": 1
	},
	{
		"name": "Minimap Render Detail",
		"identifier": "magnificent_minimap:minimap_render_detail",
		"type": "dropdown",
		"option": [
			"Low (Fastest)",
			"Medium (Average)",
			"High (Slow)",
			"Ultra (Very Slow)"
		],
		"value": 0
	},
	{
		"name": "Minimap Frame Cache",
		"identifier": "magnificent_minimap:minimap_frame_cache",
		"type": "dropdown",
		"option": [
			"None",
			"Safe",
			"Aggresive"
		],
		"value": 0
	},
	{
		"name": "Clear Saved Minimap Data",
		"identifier": "magnificent_minimap:clear_minimap",
        "tooltip": "Clear this if you get artifact or error on the minimap.",
		"type": "toggle",
		"value": false
	}
]);

CONFIG.send();

var render_pixel = 18;
var zoom = 0.7;
var render_distance = 18;
var rotate_minimap = false;
var round_minimap = false;
var enlarge_minimap = true;
var minimap_frame_per_second = 5;
var minimap_style = 1;
var render_entity = true;
var render_minimap = true;
var minimap_frame_cache = 0;
var minimap_tilt = 1;

var player_starting_bad_apple = {};
var render_chunk_offset = [];
var minimap_render_detail = 0;
// let total_player = 0;

let SavedDataTemporary = {};
function applyPreset(preset){
    if(preset == 1){
        CONFIG.setValue("magnificent_minimap:zoom", 5);
        CONFIG.setValue("magnificent_minimap:render_minimap", true);
        CONFIG.setValue("magnificent_minimap:minimap_tilt", 0);
        CONFIG.setValue("magnificent_minimap:round_minimap", false);
        CONFIG.setValue("magnificent_minimap:enlarge_minimap", true);
        CONFIG.setValue("magnificent_minimap:rotate_minimap", false);
        CONFIG.setValue("magnificent_minimap:render_entity", true);
        CONFIG.setValue("magnificent_minimap:minimap_frame_per_second", 10);
        CONFIG.setValue("magnificent_minimap:lower_frame_per_second_when_move_fast", false);
        CONFIG.setValue("magnificent_minimap:render_distance", 24);
        CONFIG.setValue("magnificent_minimap:minimap_style", 1);
        CONFIG.setValue("magnificent_minimap:minimap_render_detail", 0);
        CONFIG.setValue("magnificent_minimap:minimap_frame_cache", 0);
    }else if(preset == 2){
        CONFIG.setValue("magnificent_minimap:zoom", 5);
        CONFIG.setValue("magnificent_minimap:render_minimap", true);
        CONFIG.setValue("magnificent_minimap:minimap_tilt", 0);
        CONFIG.setValue("magnificent_minimap:round_minimap", false);
        CONFIG.setValue("magnificent_minimap:enlarge_minimap", true);
        CONFIG.setValue("magnificent_minimap:rotate_minimap", true);
        CONFIG.setValue("magnificent_minimap:render_entity", true);
        CONFIG.setValue("magnificent_minimap:minimap_frame_per_second", 12);
        CONFIG.setValue("magnificent_minimap:lower_frame_per_second_when_move_fast", true);
        CONFIG.setValue("magnificent_minimap:render_distance", 14);
        CONFIG.setValue("magnificent_minimap:minimap_style", 0);
        CONFIG.setValue("magnificent_minimap:minimap_render_detail", 0);
        CONFIG.setValue("magnificent_minimap:minimap_frame_cache", 1);
    }else if(preset == 3){
        CONFIG.setValue("magnificent_minimap:zoom", 5);
        CONFIG.setValue("magnificent_minimap:render_minimap", true);
        CONFIG.setValue("magnificent_minimap:minimap_tilt", 4);
        CONFIG.setValue("magnificent_minimap:round_minimap", false);
        CONFIG.setValue("magnificent_minimap:enlarge_minimap", true);
        CONFIG.setValue("magnificent_minimap:rotate_minimap", true);
        CONFIG.setValue("magnificent_minimap:render_entity", true);
        CONFIG.setValue("magnificent_minimap:minimap_frame_per_second", 10);
        CONFIG.setValue("magnificent_minimap:lower_frame_per_second_when_move_fast", true);
        CONFIG.setValue("magnificent_minimap:render_distance", 28);
        CONFIG.setValue("magnificent_minimap:minimap_style", 2);
        CONFIG.setValue("magnificent_minimap:minimap_render_detail", 1);
        CONFIG.setValue("magnificent_minimap:minimap_frame_cache", 1);
    }else if(preset == 4){
        CONFIG.setValue("magnificent_minimap:zoom", 10);
        CONFIG.setValue("magnificent_minimap:render_minimap", true);
        CONFIG.setValue("magnificent_minimap:minimap_tilt", 0);
        CONFIG.setValue("magnificent_minimap:round_minimap", true);
        CONFIG.setValue("magnificent_minimap:enlarge_minimap", true);
        CONFIG.setValue("magnificent_minimap:rotate_minimap", true);
        CONFIG.setValue("magnificent_minimap:render_entity", true);
        CONFIG.setValue("magnificent_minimap:minimap_frame_per_second", 10);
        CONFIG.setValue("magnificent_minimap:lower_frame_per_second_when_move_fast", false);
        CONFIG.setValue("magnificent_minimap:render_distance", 28);
        CONFIG.setValue("magnificent_minimap:minimap_style", 1);
        CONFIG.setValue("magnificent_minimap:minimap_render_detail", 2);
        CONFIG.setValue("magnificent_minimap:minimap_frame_cache", 1);
    }else if(preset == 5){
        CONFIG.setValue("magnificent_minimap:zoom", 7);
        CONFIG.setValue("magnificent_minimap:render_minimap", true);
        CONFIG.setValue("magnificent_minimap:minimap_tilt", 0);
        CONFIG.setValue("magnificent_minimap:round_minimap", true);
        CONFIG.setValue("magnificent_minimap:enlarge_minimap", true);
        CONFIG.setValue("magnificent_minimap:rotate_minimap", true);
        CONFIG.setValue("magnificent_minimap:render_entity", true);
        CONFIG.setValue("magnificent_minimap:minimap_frame_per_second", 10);
        CONFIG.setValue("magnificent_minimap:lower_frame_per_second_when_move_fast", true);
        CONFIG.setValue("magnificent_minimap:render_distance", 28);
        CONFIG.setValue("magnificent_minimap:minimap_style", 4);
        CONFIG.setValue("magnificent_minimap:minimap_render_detail", 2);
        CONFIG.setValue("magnificent_minimap:minimap_frame_cache", 2);
    }else if(preset == 6){
        CONFIG.setValue("magnificent_minimap:zoom", 7);
        CONFIG.setValue("magnificent_minimap:render_minimap", false);
        CONFIG.setValue("magnificent_minimap:minimap_tilt", 0);
        CONFIG.setValue("magnificent_minimap:round_minimap", true);
        CONFIG.setValue("magnificent_minimap:enlarge_minimap", false);
        CONFIG.setValue("magnificent_minimap:rotate_minimap", true);
        CONFIG.setValue("magnificent_minimap:render_entity", true);
        CONFIG.setValue("magnificent_minimap:minimap_frame_per_second", 8);
        CONFIG.setValue("magnificent_minimap:lower_frame_per_second_when_move_fast", false);
        CONFIG.setValue("magnificent_minimap:render_distance", 0);
        CONFIG.setValue("magnificent_minimap:minimap_style", 0);
        CONFIG.setValue("magnificent_minimap:minimap_render_detail", 1);
        CONFIG.setValue("magnificent_minimap:minimap_frame_cache", 0);
    }
}

function tiltCoord(x, y, tilt, fov = 1.0, zoom = 1.0, rotation = 0.0) {
    // return { x, z: y}
    const sTilt = Math.sin(tilt);
    const cTilt = Math.cos(tilt);

    const rot = rotation * Math.PI / 180;
    const sRot = Math.sin(rot);
    const cRot = Math.cos(rot);

    x *= zoom;
    y *= zoom;

    let rx = y;
    let ry = x * cTilt;
    let z = 1.0;
    if(tilt > 0.0){
        let rz = x * sTilt;

        const camZ = 1.0;
        z = Math.max(rz + camZ, 0.001);
    }

    let xr = (rx / z) / fov;
    let yr = (ry / z) / fov;
    
    let px = xr * cRot - yr * sRot;
    let py = xr * sRot + yr * cRot;

    return {
        x: px,
        z: py
    };
}

function inverseTiltCoord(px, py, tilt, fov = 1.0, zoom = 1.0, rotation = 0.0) {
    const sTilt = Math.sin(tilt);
    const cTilt = Math.cos(tilt);

    const rot = rotation * Math.PI / 180;
    const sRot = Math.sin(rot);
    const cRot = Math.cos(rot);

    const xr = px * cRot + py * sRot;
    const yr = -px * sRot + py * cRot;

    if (!isFinite(xr) || !isFinite(yr)) return null;
    const camZ = 1.0;

    const k = (yr * fov * sTilt) / cTilt;

    if (Math.abs(1 - k) < 0.001) return null;

    const z = camZ / (1.0 - k);

    if (z <= 0 || !isFinite(z) || isNaN(z)) return null;

    const rx = xr * z * fov;
    const ry = yr * z * fov;
    const rz = z - camZ;

    if (!isFinite(rx) || !isFinite(ry) || !isFinite(rz)) return null;
    const x = ry * cTilt + rz * sTilt;
    const y = rx;

    if (!isFinite(x) || !isFinite(y)) return null;
    const maxRange = 99999;
    if (Math.abs(x) > maxRange || Math.abs(y) > maxRange) return null;
    if (zoom < 0.0001) return null;

    return {
        x: x / zoom,
        z: y / zoom
    };
}

function encodeRLEToString(arr) {
    if (arr.length === 0) return "";

    const result = [];
    let prev = arr[0];
    let count = 1;

    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === prev) {
            count++;
        } else {
            result.push(count > 1 ? `${prev}:${count}` : prev);
            prev = arr[i];
            count = 1;
        }
    }

    result.push(count > 1 ? `${prev}:${count}` : prev);
    return result;
}

function decodeRLEString(str) {
    if (!str) return [];

    const result = [];

    for (const part of str) {
        if (part.includes(":")) {
            const [value, count] = part.split(":");
            const n = parseInt(count, 10);
            for (let i = 0; i < n; i++) result.push(value);
        } else {
            result.push(part);
        }
    }

    return result;
}

function clearChunkData(){
    world.getDynamicPropertyIds().filter(e => e.startsWith("chunk-minimap-")).forEach(id =>{
        world.setDynamicProperty(id);
    })
}

function loadChunkData(dimension, position){
    let position_x = Math.floor(position.x / 8);
    let position_z = Math.floor(position.z / 8);
    let id = "chunk-minimap-" + minimap_style + "-" + dimension.id + "-" + position_x.toString() + "-" + position_z.toString();
    let data = SavedDataTemporary[id];
    if(data == undefined){
        data = world.getDynamicProperty(id);
        if(data != undefined){
            SavedDataTemporary[id] = decodeRLEString(data.split("|"));
            // console.warn(SavedDataTemporary[id].length, SavedDataTemporary[id])
            system.runTimeout(() => delete SavedDataTemporary[id], 100 + Math.random() * 400);
            // load_counter++;
        }else{
            return undefined;
        }
    }

    let fraction_x = position.x - (position_x * 8);
    let fraction_z = position.z - (position_z * 8);
    // if(SavedDataTemporary[id][fraction_x * 8 + fraction_z] == undefined) console.warn(fraction_x * 8, fraction_z * 8, position.x, position.z)
    return SavedDataTemporary[id]?.[fraction_x * 8 + fraction_z];
}

function* handleSaveChunk(dimension, position, id, position_x, position_z){
    let data = [];
    position_x *= 8;
    position_z *= 8;
    for(let x = 0; x < 8; x++){
        for(let z = 0; z < 8; z++){
            let temp = MapPixelData[dimension.id][Vector.toString({ x: position_x + x, y: position.y, z: position_z + z})];
            if(temp == undefined) return;
            data.push(temp[minimap_style] || "");
            yield;
        }
    }
    
    world.setDynamicProperty(id, encodeRLEToString(data).join("|"));
    yield;
}

function getBlockColor(block){
    if(block == undefined) return { red: 0, green: 0, blue: 0, alpha: 0 };
    let map_color = block.getComponent("minecraft:map_color");
    if(map_color == undefined) return VanillaMapColor[block.typeId] != undefined ? { ... VanillaMapColor[block.typeId]} : { red: 0, green: 0, blue: 0, alpha: 0 };
    // console.warn(JSON.stringify(map_color?.tintedColor), JSON.stringify(map_color?.color))
    return map_color.tintedColor || map_color.color;
}

function saveChunkData(dimension, position){
    let position_x = Math.floor(position.x / 8);
    let position_z = Math.floor(position.z / 8);
    let id = "chunk-minimap-" + minimap_style + "-" + dimension.id + "-" + position_x.toString() + "-" + position_z.toString();
    // if(Math.random() < 0.5 && (SavedDataTemporary[id] != undefined || world.getDynamicProperty(id) != undefined)) return;
    system.runJob(handleSaveChunk(dimension, position, id, position_x, position_z));
    // save_counter++;
}

function* getTopBlockData(dimension, position, duration){
    let id = position.toString();

    let ray = dimension.getBlockFromRay(Vector.add(position, 0.5), { x: 0, y: -1, z: 0 }, { maxDistance: 383, includeLiquidBlocks: true, includePassableBlocks: true});
    let block = ray?.block;
    if(block == undefined || block.isValid == false){
        let timeout = system.runTimeout(() => delete BlockData[dimension.id][id], duration);
        BlockData[dimension.id][id] = { next_update: duration, height: (dimension.id == "minecraft:overworld") ? -64 : 0, c: [ 0, 0, 0 ], t: timeout, d: system.currentTick + duration - 20};
        return 0;
    }
    yield;
    if(BlockData[dimension.id][id]?.t != undefined) system.clearRun(BlockData[dimension.id][id].t);
    yield;
    let color = getBlockColor(block);
    let height = block.location.y;
    if(block.isLiquid){
        let surface = dimension.getTopmostBlock({ x: position.x, z: position.z });
        let surface_color = getBlockColor(surface);
        color.red = (color.red * 3 + surface_color.red) / 4;
        color.green = (color.green * 3 + surface_color.green) / 4;
        color.blue = (color.blue * 3 + surface_color.blue) / 4;
        height = surface.location.y;
        yield;
    }else{
        if(color.red == 0 && color.green == 0 && color.blue == 0){
            let below = block.below();
            if(below) color = getBlockColor(below);
        }
    }

    color.red = parseInt(color.red * 15);
    color.green = parseInt(color.green * 15);
    color.blue = parseInt(color.blue * 15);

    let timeout = system.runTimeout(() => delete BlockData[dimension.id][id], duration);
    yield;
    BlockData[dimension.id][id] = { next_update: duration, height, c: [ color.red, color.green, color.blue ], t: timeout, d: system.currentTick + duration - 20};
    // if(MapPixelData[dimension.id][id]) MapPixelData[dimension.id][id].next_update = 0;
}

function* getTopCeilingBlockData(dimension, position, duration){
    let id = position.toString();
    let blocks_ceil_pos = dimension.getBlocks(new BlockVolume({x: position.x, y: 127, z: position.z}, { x: position.x, y: 32, z: position.z}), { includeTypes: [ "minecraft:air" ]});
    // console.warn(JSON.stringify(blocks_ceil_pos))
    try{
        blocks_ceil_pos = blocks_ceil_pos.getMax();
    }catch(error){
        if(BlockData[dimension.id][id]?.t != undefined) system.clearRun(BlockData[dimension.id][id].t);
        let timeout = system.runTimeout(() => delete BlockData[dimension.id][id], duration);
        yield;
        BlockData[dimension.id][id] =  { next_update: duration, height: position.y, c: [ 0, 0, 0 ], t: timeout, d: system.currentTick + duration - 20};
        return 0;
    }
    // if(Math.random() < 0.2) console.warn(JSON.stringify(blocks_ceil_pos))
    
    let ray = dimension.getBlockFromRay(Vector.subtract(blocks_ceil_pos, { x: 0.5, y: 1, z: 0.5}), { x: 0, y: -1, z: 0 }, { maxDistance: 97, includeLiquidBlocks: true, includePassableBlocks: true});
    let block = ray?.block;
    if(block == undefined || block.isValid == false){
        BlockData[dimension.id][id] = undefined;
        return 0;
    }
    yield;
    if(BlockData[dimension.id][id]?.t != undefined) system.clearRun(BlockData[dimension.id][id].t);
    let color = getBlockColor(block);
    let height = block.location.y;
    // if(block.isLiquid){
    //     let surface = dimension.getTopmostBlock({ x: position.x, z: position.z });
    //     let surface_color = surface.getComponent("minecraft:map_color")?.tintedColor || { red: 0, green: 0, blue: 0, alpha: 0 };
    //     color.red = (color.red * 3 + surface_color.red) / 4;
    //     color.green = (color.green * 3 + surface_color.green) / 4;
    //     color.blue = (color.blue * 3 + surface_color.blue) / 4;
    //     height = surface.location.y;
    // }else{
        if(color.red == 0 && color.green == 0 && color.blue == 0){
            let below = block.below();
            if(below) color = getBlockColor(below);
        }
    // }

    color.red = parseInt(color.red * 15);
    color.green = parseInt(color.green * 15);
    color.blue = parseInt(color.blue * 15);

    let timeout = system.runTimeout(() => delete BlockData[dimension.id][id], duration);
    yield;
    BlockData[dimension.id][id] = { next_update: duration, height, c: [ color.red, color.green, color.blue ], t: timeout, d: system.currentTick + duration - 20};
}

function drawCompassDirection(rot){
    let canvas_15x15 = [];
    for(let x = 0; x < 15; x++){
        let buffer = [];
        for(let y = 0; y < 15; y++){
            buffer.push("");
        }
        canvas_15x15.push(buffer);
    }
    compass_direction.forEach(offset =>{
        let temp_x = Math.sin(rot * Math.PI / 180) * (offset.z) + Math.cos(rot * Math.PI / 180) * (offset.x);
        let temp_z = Math.cos(rot * Math.PI / 180) * (offset.z) - Math.sin(rot * Math.PI / 180) * (offset.x);
        temp_x *= round_minimap ? 7 : 10;
        temp_z *= round_minimap ? 7 : 10;
        let location = { x: Math.round(Math.max(0, Math.min(14, temp_x + 7))), z: Math.round(Math.max(0, Math.min(14, temp_z + 7))) };
        canvas_15x15[location.x][location.z] = offset.symbol;
    })

    return canvas_15x15.map(data => data.join("")).join("\n");
}

function drawMap(dimension, location){
    let id = location.toString();
    if(BlockData[dimension.id][id] == undefined) return;
    if(MapPixelData[dimension.id][id] == undefined) MapPixelData[dimension.id][id] = [undefined, undefined, undefined, undefined, undefined];
    let r, g, b;

    let need_refresh = false;
    let data = BlockData[dimension.id][id];
    let above, below;

    let color = data.c ? { red: data.c[0], green: data.c[1], blue: data.c[2] } : { red: 0, green: 0, blue: 0 };

    if(minimap_style == 0){
    }else if(minimap_style == 1){
        above = BlockData[dimension.id][Vector.add(location, new Vector(0, 0, -1)).toString()];
        let light = Math.max(0, data.height - above?.height);
        let shadow = Math.max(0, above?.height - data.height);
        let checker = (location.x + (location.z % 2)) % 2 != 0;

        if((light > 0 && checker) || light > 1){
            color.red *= 1.0;
            color.green *= 1.0;
            color.blue *= 1.0;
        }else if((shadow > 0 && checker) || shadow > 1){
            color.red *= 0.8;
            color.green *= 0.8;
            color.blue *= 0.8;
        }else{
            color.red *= 0.9;
            color.green *= 0.9;
            color.blue *= 0.9;
        }
        need_refresh = above == undefined;
    }else if(minimap_style == 2){
        above = BlockData[dimension.id][Vector.add(location, new Vector(0, 0, -1)).toString()];
        let light = Math.max(0, data.height - above?.height);
        let shadow = Math.max(0, above?.height - data.height);

        if(light > 0){
            color.red *= 1.0;
            color.green *= 1.0;
            color.blue *= 1.0;
        }else if(shadow > 0){
            color.red *= (1 / shadow) * 0.5 + 0.4;
            color.green *= (1 / shadow) * 0.5 + 0.4;
            color.blue *= (1 / shadow) * 0.5 + 0.4;
        }else{
            color.red *= 0.9;
            color.green *= 0.9;
            color.blue *= 0.9;
        }
        need_refresh = above == undefined || below == undefined;
    }else if(minimap_style == 3){
        let height_map = Math.min(1, Math.max(0, (data.height - 32) / 312) + 0.5) * 15;
        below = BlockData[dimension.id][Vector.add(location, new Vector(0, 0, -1)).toString()];
        need_refresh = above == undefined || below == undefined;
        let light = Math.max(0, data.height - below?.height);
        let shadow = Math.max(0, below?.height - data.height);

        if(shadow == 0) for(let i = 2; i < 5; i++){
            let below_off = BlockData[dimension.id][Vector.add(location, new Vector(0, 0, -i)).toString()];
            if(below_off == undefined){ 
                need_refresh = true;
                break;
            }
            shadow = Math.max(0, below_off?.height - data.height);
            if(shadow > 0) break;
        }
        if(shadow > 0){
            shadow += 1;
            height_map *= (1 / shadow) * 0.5 + 0.4;
        }else if(light == 0){
            height_map *= 0.8;
        }

        color.red = height_map;
        color.green = height_map;
        color.blue = height_map;

    }else if(minimap_style == 4){
        above = BlockData[dimension.id][Vector.add(location, new Vector(-1, 0, -1)).toString()];
        below = BlockData[dimension.id][Vector.add(location, new Vector(0, 0, -1)).toString()];
        need_refresh = above == undefined || below == undefined;
        let light = Math.max(0, data.height - above?.height);
        let shadow = Math.max(0, below?.height - data.height);

        if(shadow == 0) for(let i = 2; i < 5; i++){
            let below_off = BlockData[dimension.id][Vector.add(location, new Vector(-i / 4, 0, -i).round()).toString()];
            if(below_off == undefined){ 
                need_refresh = true;
                break;
            }
            shadow = Math.max(0, below_off?.height - data.height);
            if(shadow > 0) break;
        }

        if(shadow > 0){
            // shadow = 7 - shadow;
            shadow += 1;
            color.red *= (1 / shadow) * 0.5 + 0.4;
            color.green *= (1 / shadow) * 0.5 + 0.4;
            color.blue *= (1 / shadow) * 0.5 + 0.4;
        }else if(light > 0){
            color.red *= 1.0;
            color.green *= 1.0;
            color.blue *= 1.0;
        }else {
            color.red *= 0.9;
            color.green *= 0.9;
            color.blue *= 0.9;
        }
    }

    
    r = Math.min(15, Math.floor(color.red));
    g = Math.min(15, Math.floor(color.green));
    b = Math.min(15, Math.floor(color.blue));
    
    let ascii = BlueHex[b] + NumToHex[r] + NumToHex[g];

    MapPixelData[dimension.id][id][minimap_style] = ascii;

    system.runTimeout(() => delete MapPixelData[dimension.id][id], 100);
    if(need_refresh){
        location = Vector.divide(location, 8).floor().multiply(8).add(7);
        location.y = 320;
        id = location.toString();
        if(BlockData[dimension.id][id] != undefined) BlockData[dimension.id][id].d = 0;
    }
}

let renderEntityCahce = {};

function* renderEntityMinimap(id, dimension, playerPos, distance, rot){
    rot = -rot;
    renderEntityCahce[id] = {};
    let entities = dimension.getEntities({ location: playerPos, maxDistance: (distance * 1.5) * zoom * minimap_tilt });
    if(entities.length == 0){
        renderEntityCahce[id] = undefined;
        return;
    }
    for(let entity of entities){
        if(entity.id == id || !entity.isValid) continue;
        if(entity.typeId == "mmap:atlas_map_container") continue;
        let relative = Vector.subtract(entity.location, playerPos);
        // let temp_x = Math.sin(rot * Math.PI / 180) * (relative.z) + Math.cos(rot * Math.PI / 180) * (relative.x);
        // let temp_z = Math.cos(rot * Math.PI / 180) * (relative.z) - Math.sin(rot * Math.PI / 180) * (relative.x);
        // temp_x *= (1 / zoom);
        // temp_z *= (1 / zoom);
        
        // if(minimap_tilt > 1){
        //     temp_z /= minimap_tilt;
        //     temp_x /= (distance * minimap_tilt) / ((distance * minimap_tilt) + temp_z);
        // }
        let pos = inverseTiltCoord(relative.x, relative.z, (minimap_tilt - 1) * 0.0125, 1.0, zoom, rot);
        if(pos == null) continue;
        let pixel = new Vector(pos.x, 0, pos.z).round();
        if(entity.typeId == "minecraft:player"){
            renderEntityCahce[id][pixel.toString()] = "羅";
            renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: 0}).toString()] = "羅";
            renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: 0}).toString()] = "羅";
            renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: 1}).toString()] = "羅";
            renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: -1}).toString()] = "羅";
        }else if(entity.hasComponent("minecraft:health")){
            renderEntityCahce[id][pixel.toString()] = "";
            renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: 0}).toString()] = "";
            renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: 0}).toString()] = "";
            renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: 1}).toString()] = "";
            renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: -1}).toString()] = "";
        }else{
            renderEntityCahce[id][pixel.toString()] = "刺";
            renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: 0}).toString()] = "刺";
            renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: 0}).toString()] = "刺";
            renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: 1}).toString()] = "刺";
            renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: -1}).toString()] = "刺";
        }
        renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: 1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: 1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: -1, y: 0, z: -1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 1, y: 0, z: -1}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 2, y: 0, z: 0}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: -2, y: 0, z: 0}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: 2}).toString()] = "";
        renderEntityCahce[id][Vector.add(pixel, { x: 0, y: 0, z: -2}).toString()] = "";
        yield;
    };
}

export function* getMapPixel(dimension, location){
    let id = location.round().toString();
    if(BlockData[dimension.id][id] == undefined){
        let data = loadChunkData(dimension, location);
        yield;
        if(data == undefined) return "";
        if(data == undefined || data?.length <= 1){
            return data || "";
        }
        return getCharStorage(data);
    }
    if(MapPixelData[dimension.id][id] == undefined || MapPixelData[dimension.id][id][minimap_style] == undefined){
        drawMap(dimension, location);
        yield;
    }
    yield;
    return getCharStorage(MapPixelData[dimension.id][id]?.[minimap_style]);
}
let is_generating_minimap = {};
let renderCache = {};

var rotation_cahce = new Map();
var pixel_cahce = {};

function* renderMinimap(id, dimension, playerPos, distance, rot, velocity){
    if(minimap_frame_cache == 0){
        velocity = 0;
    }else{
        velocity *= minimap_frame_cache / 4;
        velocity *= (minimap_frame_per_second / 20) + 1;
        velocity *= (minimap_frame_cache == 1) ? 0.8 : 0.7;
        velocity += (minimap_frame_cache == 1) ? 0.1 : 0.25;
        velocity = Math.min((minimap_frame_cache == 1) ? 0.75 : 0.9, velocity);
    }
    rot = -Math.round(rot / 3) * 3;
    const tilt = (minimap_tilt - 1) * 0.0125;
    // let start = system.currentTick;
    let generating_count = 0;
    if(render_distance > 0) playerPos = Vector.multiply(playerPos, render_distance).floor().divide(render_distance);

    if(renderCache[id] == undefined){
        renderCache[id] = [];
        for(let x = -distance; x <= distance; x++){
            let buffer = [];
            for(let y = -distance; y <= distance; y++){
                buffer.push("");
            }
            renderCache[id].push(buffer);
        }
    }
    yield;

    for(let x = -distance; x <= distance; x++){
        for(let z = -distance; z <= distance; z++){
            yield;
            if(Math.random() < velocity) continue; 
            if(round_minimap && Math.sqrt(x**2 + z**2) >= distance){
                renderCache[id][x+distance][z+distance] = "";
                continue;
            }
            let radar = new Vector(x, 0, z).round().toString();
            let pixel_id = `${x}|${z}`;

            const pixel_cahce_data = pixel_cahce[id];
            if(render_entity && renderEntityCahce[id] && renderEntityCahce[id][radar] != undefined){
                renderCache[id][x+distance][z+distance] = renderEntityCahce[id][radar];
                pixel_cahce_data.set(pixel_id);
                continue;
            }
            let id_trx = pixel_id + `|${tilt}|${zoom}|${rot}`;
            let pos;
            if(rotation_cahce.has(id_trx)){
                pos = { ...rotation_cahce.get(id_trx) };
            }else{
                let pos_temp = { x, z };
                pos_temp = tiltCoord(pos_temp.x, pos_temp.z, tilt, 1.0, zoom, rot);
                
                rotation_cahce.set(id_trx, pos_temp);
                pos = pos_temp;
            }
            let target = Vector.add(playerPos, new Vector(pos.x, 0, pos.z)).round();
            target.y = 320;

            let pixel_cahce_temp = pixel_cahce_data.get(pixel_id);
            if(pixel_cahce_temp && Vector.isEqual(pixel_cahce_temp, target)){
                continue;
            }
            let can_skip = true;
            if(render_minimap){
                const pixel = yield* getMapPixel(dimension, target);
                renderCache[id][x+distance][z+distance] = pixel;
                if(pixel == "") can_skip = false;
            }else{
                if((Math.round(target.x) % 16 == 0 || Math.round(target.z) % 16 == 0) && Math.round(Math.abs(target.x) + 2) % 8 < 4 == Math.round(Math.abs(target.z) + 2) % 8 < 4){
                    renderCache[id][x+distance][z+distance] = Grayscale[2];
                }else if((Math.round(target.x / 16 + 0.5) % 2 == Math.round(target.z / 16 + 0.5) % 2 )){
                    renderCache[id][x+distance][z+distance] = Grayscale[1];
                }else {
                    renderCache[id][x+distance][z+distance] = "";
                }
            }
            // renderCache[id][x+distance][z+distance] = can_skip ? "刺" : "";
            
            pixel_cahce_data.set(pixel_id, can_skip ? target : undefined);
            generating_count++;
        }
    }

    is_generating_minimap[id]--;
}

let player_generating_map_counter = {};

function* generateMinimap(playerId, dimension, playerPos, parent = false){
    if(player_generating_map_counter[playerId] == undefined) player_generating_map_counter[playerId] = 0;
    PlayerIsGenerating[playerId] = true;
    playerPos = Vector.divide(playerPos, 8).floor().multiply(8);
    // let start = system.currentTick;

    let offset_data = render_chunk_offset[player_generating_map_counter[playerId] % render_chunk_offset.length];
    // for(let offset_data of render_chunk_offset){
        let last_index = offset_data.length - 1;
        let last_target = Vector.add(playerPos, offset_data[last_index]);

        if(!dimension.isChunkLoaded({ x: last_target.x, z: last_target.z, y: playerPos.y})){
            player_generating_map_counter[playerId]++;
            PlayerIsGenerating[playerId] = false;
            return;
        }
        last_target.y = 320;
        let last = last_target.toString();
        // if(BlockData[dimension.id][last]?.d > system.currentTick) continue;
        if(BlockData[dimension.id][last]?.d > system.currentTick){
            player_generating_map_counter[playerId]++;
            PlayerIsGenerating[playerId] = false;
            if(!parent) yield* generateMinimap(playerId, dimension, playerPos, true);
            return;
        };

        let position_x = Math.floor(last_target.x / 8);
        let position_z = Math.floor(last_target.z / 8);
        let id = "chunk-minimap-" + minimap_style + "-" + dimension.id + "-" + position_x.toString() + "-" + position_z.toString();
        if(Math.random() < 0.5 && (SavedDataTemporary[id] != undefined || world.getDynamicProperty(id) != undefined)){
            player_generating_map_counter[playerId]++;
            PlayerIsGenerating[playerId] = false;
            if(!parent) yield* generateMinimap(playerId, dimension, playerPos, true);
            return;
        }

        if(BlockData[dimension.id][last] != undefined) system.clearRun(BlockData[dimension.id][last].t);

        let i = 0;
        let has_error = false;
        for(let offset of offset_data){
            yield;
            try {
                let target = Vector.add(playerPos, offset);
                target.y = 320;
                if(dimension.id == "minecraft:nether"){
                    yield* getTopCeilingBlockData(dimension, target, parseInt(200 + (i == last_index ? -20 : Math.random() * 400)));
                }else{
                    yield* getTopBlockData(dimension, target, parseInt(200 + (i == last_index ? -20 : Math.random() * 400)));
                }
                system.runTimeout(() => drawMap(dimension, target), 1);
            } catch (error) {
                has_error = true;
                console.warn("[magnificent Minimap] Error while generating map,", error)
                if(BlockData[dimension.id][last]) BlockData[dimension.id][last].next_update = 0;
                break;
            }
            i++;
        }
        if(!has_error) system.runTimeout(() => saveChunkData(dimension, last_target), 20);
    // }
    // console.warn("generate Counter", generating_count, system.currentTick - start)
    // await system.waitTicks(2 + parseInt(Math.random() * 18));
    // system.runTimeout(() => PlayerIsGenerating[playerId] = false, 20);
    player_generating_map_counter[playerId]++;
    PlayerIsGenerating[playerId] = false;
}

function getCurrentBiome(playerData){
    if(!playerData.dimension.isChunkLoaded(playerData.location)) return undefined;
    let biome = playerData?.dimension?.getBiome(playerData.location)?.id;
    if(biome){
        let list = biome.split(":")[1].split("_");
        if(list.length > 1){
            biome = list.map(e =>{
                if(e.length > 3){
                    return e[0].toUpperCase() + e.substring(1);
                }else{
                    return e;
                }
            }).join(" ");
        }else{
            biome = list[0][0].toUpperCase() + list[0].substring(1)
        }
        return [ DimensionName[playerData.dimension.id], biome ];
    }
    return undefined;
}

function renderMinimapUI(playerData){
    let renderer = renderCache[playerData.id];
    if(player_reload_screen[playerData.id]){
        renderer = "";
    }else{
        if(renderer != undefined){
            renderer = renderer.map(e => e.join("")).join("\n");
        }else{
            renderer = "";
        }
    }
    let rot = ((-playerData.getRotation().y + 180) + 360);
    let compass_render = drawCompassDirection(rotate_minimap ? rot : 0);
    let player_rotation = 1;
    if(!rotate_minimap){
        player_rotation = RotationName[Math.round(1 + (rot % 360) / 10)];
    }
    let enlarge = (playerData.isSneaking && enlarge_minimap) ? "b" : "a";
    let round_map = (round_minimap) ? "c" : "d";

    let render_scale = 8;
    if(minimap_render_detail == 1){
        render_scale = 6;
    }else if(minimap_render_detail == 2){
        render_scale = 4;
    }else if(minimap_render_detail == 3){
        render_scale = 3;
    }

    if(player_starting_bad_apple[playerData.id] != undefined){
        round_map = "d";
        player_rotation = 0;
        render_scale = 4;
    }

    if(CONFIG.getValue("magnificent_minimap:biome_name")){
        playerData.runCommand("scriptevent ui_load:mm_render_1 mm_render_1");
    }else{
        let biome_name = getCurrentBiome(playerData);
        if(biome_name != undefined) playerData.runCommand("scriptevent ui_load:mm_render_1 " + biome_name[0].padStart(64, "~") + biome_name[1].padStart(64, "~") + "mm_render_1");
    }

    let player_sneaking = playerData.inputInfo.getButtonState("Sneak") == "Pressed" ? "b" : "a";

    system.sendScriptEvent("ui_load_script:mm_render_0", playerData.id + "|" + enlarge + round_map + player_sneaking + render_scale + player_rotation + renderer + "mm_render_0");

    if(player_starting_bad_apple[playerData.id] != undefined){
        playerData.runCommand("scriptevent ui_sub_load:mm_render_0 ");
    }else{
        playerData.runCommand("scriptevent ui_sub_load:mm_render_0 " + compass_render);
    }
    renderer = undefined;
}

function playBadApple(id){
    let frames = BadAppleFrames[player_starting_bad_apple[id]];
    if(frames == undefined){
        delete player_starting_bad_apple[id];
        delete renderCache[id];
        return;
    }
    let render = frames.map(e => e.map(f => Grayscale[f]));
    player_starting_bad_apple[id] += 1;
    return render;
}

function updateChunkGenerationPattern(size){
    let list = [];
    let block = Math.round(size / 8);
    for(let x = -block; x <= block; x++){
        for(let z = -block; z <= block; z++){
            if(Math.sqrt(x**2 + z**2) > block) continue;
            let chunk = [];
            for(let sub_x = 0; sub_x < 8; sub_x++){
                for(let sub_z = 0; sub_z < 8; sub_z++){
                    chunk.push({ x: sub_x + 8 * x, y: 0, z: sub_z + 8 * z});
                }
            }
            list.push(chunk);
        }
    }
    render_chunk_offset = list;
    console.warn("[Magnificent Minimap] generating new chunk offset!");
}

let player_reload_screen = {};
let player_dithering_velocity = {};

let DimensionName = {
    "minecraft:overworld": "Overworld",
    "minecraft:the_end": "The End",
    "minecraft:nether": "Nether",
}

system.runInterval(() => {
    if(CONFIG.getValue("magnificent_minimap:clear_minimap") == true){
        CONFIG.setValue("magnificent_minimap:clear_minimap", false);
        clearChunkData();
    }
    if(CONFIG.getValue("magnificent_minimap:presets") != 0){
        applyPreset(CONFIG.getValue("magnificent_minimap:presets"));
        CONFIG.setValue("magnificent_minimap:presets", 0);
    }

    rotate_minimap = CONFIG.getValue("magnificent_minimap:rotate_minimap");
    minimap_tilt = CONFIG.getValue("magnificent_minimap:minimap_tilt") + 1;
    round_minimap = CONFIG.getValue("magnificent_minimap:round_minimap");
    enlarge_minimap = CONFIG.getValue("magnificent_minimap:enlarge_minimap");
    minimap_frame_per_second = CONFIG.getValue("magnificent_minimap:minimap_frame_per_second");
    minimap_style = CONFIG.getValue("magnificent_minimap:minimap_style");
    render_entity = CONFIG.getValue("magnificent_minimap:render_entity");
    minimap_frame_cache = CONFIG.getValue("magnificent_minimap:minimap_frame_cache");
    render_minimap = CONFIG.getValue("magnificent_minimap:render_minimap");
    let minimap_render_detail_temp = CONFIG.getValue("magnificent_minimap:minimap_render_detail");
    let zoom_temp = CONFIG.getValue("magnificent_minimap:zoom") / 20;
    if(zoom_temp != zoom){
        zoom = zoom_temp;
        rotation_cahce.clear();
    }
    if(minimap_render_detail_temp == 0){
        render_pixel = 18;
        zoom *= 4;
    }else if(minimap_render_detail_temp == 1){
        render_pixel = 24;
        zoom *= 3;
    }else if(minimap_render_detail_temp == 2){
        render_pixel = 36;
        zoom *= 2;
    }else if(minimap_render_detail_temp == 3){
        render_pixel = 48;
        zoom *= 1.5;
    }
    let reload_screen = minimap_render_detail != minimap_render_detail_temp;
    let render_distance_temp = CONFIG.getValue("magnificent_minimap:render_distance");
    if(render_distance != render_distance_temp){
        updateChunkGenerationPattern(render_distance_temp);
    }
    minimap_render_detail = minimap_render_detail_temp;
    render_distance = render_distance_temp;
    let players = PlayerList;
    // total_player = players.length;
    let counter = 1;
    players.forEach((playerData) => {
        if(BlockData[playerData.dimension.id] == undefined) registerDimension(playerData.dimension);
        // console.warn(playerData.dimension.id, JSON.stringify(DimensionName));
        // return;
        let fps = Math.ceil(20 / (minimap_frame_per_second / ((CONFIG.getValue("magnificent_minimap:lower_frame_per_second_when_move_fast") && Vector.getLength(playerData.getVelocity()) >= 0.55) ? 2 : 1)));
        
        let frame_buffer = 1;
        if(minimap_frame_per_second > 11){
            frame_buffer = 2;
        }else if(minimap_frame_per_second > 15){
            frame_buffer = 3;
        }

        // if(playerData.isSneaking) playerData.dimension.spawnItem(a, playerData.location)
        if(is_generating_minimap[playerData.id] == undefined) is_generating_minimap[playerData.id] = 0;
        if(player_starting_bad_apple[playerData.id] != undefined){
            if(system.currentTick % 4 == 0){
                renderCache[playerData.id] = playBadApple(playerData.id);
                renderMinimapUI(playerData);
            }
            return;
        }
        if(reload_screen){
            player_reload_screen[playerData.id] = true;
            rotation_cahce.clear();
        }
        player_dithering_velocity[playerData.id] = (player_dithering_velocity[playerData.id] || 0) * 0.9 + Math.min(1, Vector.getLength(playerData.getVelocity()) * 0.75) * 0.1;
        
        if(!playerOpenAtlasMap(playerData)){
            if(render_entity && system.currentTick % fps == (counter % fps)){
                system.runJob(renderEntityMinimap(playerData.id, playerData.dimension, playerData.location, render_pixel, rotate_minimap ? (-playerData.getRotation().y + 180) : 0));
            }
            if(system.currentTick % fps == (counter % fps)){
                if(is_generating_minimap[playerData.id] < frame_buffer && !player_reload_screen[playerData.id]){
                    is_generating_minimap[playerData.id]++;
                    system.runJob(renderMinimap(playerData.id, playerData.dimension, playerData.location, render_pixel, rotate_minimap ? (-playerData.getRotation().y + 180) : 0, player_dithering_velocity[playerData.id]));
                }
                renderMinimapUI(playerData);
            }
            if(render_distance > 0 && !PlayerIsGenerating[playerData.id] && render_minimap){ 
                system.runJob(generateMinimap(playerData.id, playerData.dimension, playerData.location));
            }
        }
        if(!reload_screen && player_reload_screen[playerData.id] && is_generating_minimap[playerData.id] <= 0 && renderCache[playerData.id] != undefined){
            delete renderCache[playerData.id];
            player_reload_screen[playerData.id] = false;
        }
        counter++;
    });
    // console.warn("BlockData", estimateWorldCacheSize(BlockData).approxKB);
});

function updateMap(s){
    let location = s.block.location;
    location = Vector.divide(location, 8).floor().multiply(8).add(7);
    location.y = 320;
    let id = location.toString();
    if(BlockData[s.block.dimension.id][id]) BlockData[s.block.dimension.id][id].d = system.currentTick + 40;
}

world.afterEvents.playerBreakBlock.subscribe(s =>updateMap(s));
world.afterEvents.playerPlaceBlock.subscribe(s =>updateMap(s));
world.afterEvents.explosion.subscribe(s =>{
    const seen = new Set();
    let data = s.getImpactedBlocks().filter(item => {
        const key = `${item.location.x}_${item.location.z}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });

    data.forEach(e =>{
        updateMap({ block: e});
    })
}); 

system.afterEvents.scriptEventReceive.subscribe(s =>{
    if(s.id == "mmap:bad_apple"){
        if(s.message == "start"){
            player_starting_bad_apple[s.sourceEntity.id] = 0;
        }else{
            delete player_starting_bad_apple[s.sourceEntity.id];
            delete renderCache[s.sourceEntity.id];
        }
    }
}, { namespaces: [ "mmap" ]})

system.run(() =>{
    updateChunkGenerationPattern(render_distance);
});

world.afterEvents.worldLoad.subscribe(s =>{
    PlayerList = world.getPlayers();
    PlayerList.forEach(player =>{
        pixel_cahce[player.id] = new Map();
    })
});

world.afterEvents.playerSpawn.subscribe(s =>{
    if(!s.initialSpawn) return;
    PlayerList = world.getPlayers();
    pixel_cahce[s.player.id] = new Map();
});

world.afterEvents.playerLeave.subscribe(s =>{
    PlayerList = world.getPlayers();
    delete pixel_cahce[s.playerId];
});

world.afterEvents.playerDimensionChange.subscribe(s =>{
    if(BlockData[s.toDimension.id] == undefined) registerDimension(s.toDimension);
});

function registerDimension(dimension){
    if(BlockData[dimension.id] == undefined) BlockData[dimension.id] = {};
    if(MapPixelData[dimension.id] == undefined) MapPixelData[dimension.id] = {};
    if(DimensionName[dimension.id] == undefined) DimensionName[dimension.id] = dimension.id.split(":")[1].split("_").map(e =>{
        if(e.length > 3){
            return e[0].toUpperCase() + e.substring(1);
        }else{
            return e;
        }
    }).join(" ");
    if(!Dimensions.includes(dimension.id)) Dimensions.push(dimension.id);
}

// system.runInterval(() =>{
//     console.warn("save counter", save_counter);
//     console.warn("load counter", load_counter);
//     save_counter = 0;
//     load_counter = 0;
// }, 200)

function estimateRenderCacheMemory() {
    let players = Object.keys(renderCache).length;
    let totalCells = 0;

    for (let id in renderCache) {
        let grid = renderCache[id];
        let rows = grid.length;
        let cols = grid[0]?.length ?? 0;
        totalCells += rows * cols;
    }

    // asumsi 24 byte per cell
    let bytes = totalCells * 24;

    return {
        players,
        totalCells,
        approxKB: (bytes / 1024).toFixed(2),
        approxMB: (bytes / 1024 / 1024).toFixed(2)
    };
}

function estimateObjectSize(obj) {
    let entries = 0;

    for (let k in obj) {
        entries++;

        let v = obj[k];

        if (typeof v === "string") {
            entries += v.length; // rough
        } else if (typeof v === "object" && v !== null) {
            entries += Object.keys(v).length;
        }
    }

    // heuristic:
    // key ref + value ref + overhead ≈ 48 byte
    return entries * 48;
}

function estimateWorldCacheSize(cache) {
    let totalBytes = 0;
    let detail = {};

    for (let dim in cache) {
        let bytes = estimateObjectSize(cache[dim]);
        detail[dim] = {
            entries: Object.keys(cache[dim]).length,
            approxKB: (bytes / 1024).toFixed(2)
        };
        totalBytes += bytes;
    }

    return {
        detail,
        approxKB: (totalBytes / 1024).toFixed(2),
        approxMB: (totalBytes / 1024 / 1024).toFixed(2)
    };
}
