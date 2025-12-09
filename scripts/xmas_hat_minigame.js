import { Instance, BaseModelEntity, PointTemplate } from "cs_script/point_script";

// Known issues:
// 1. Bots spawns are broken, explanation found in a comment above the SpawnBotOnInfoTargetFix() fuction.
// 2. Dropped hats will be invisible for the players who dropped them, this is not a big deal unless you have players respawning on the same round.

// const POINT_SCRIPT_XMAS_HHAT_MINIGAME_ENTITY_NAME = "xmas_hat_minigame.script";
const PROP_PHYSICS_MULTIPLAYER_XMAS_HAT_ENTITY_NAME = "xmas_hat_minigame.xmas_hat_base";
const POINT_SOUNDEVENT_XMAS_HAT_ENTITY_NAME = "xmas_hat_minigame.xmas_hat_speaker_base";
const POINT_TEMPLATE_SPAWNER_ENTITY_NAME = "xmas_hat_minigame.spawner";
const INFO_POINT_SPAWN_CT_ENTITY_NAME = "xmas_hat_minigame.bot_spawn_fix_ct";
const INFO_POINT_SPAWN_T_ENTITY_NAME = "xmas_hat_minigame.bot_spawn_fix_t";

const MAX_HAT_PICKUP_DISTANCE_UNITS = 42;
const MAX_HAT_STACK_COUNT = 6;

const DROPPED_HAT_GLOW_ENABLE = true;
const DROPPED_HAT_GLOW_COLOR_T = { r: 185, g: 120, b: 35 };
const DROPPED_HAT_GLOW_COLOR_CT = { r: 55, g: 35, b: 185 };

const TEAM_NUMBER_T = 2;
const TEAM_NUMBER_CT = 3;

Instance.SetNextThink(Instance.GetGameTime());
Instance.SetThink(() => {
    HatPickupCheck();
    Instance.SetNextThink(Instance.GetGameTime() + 0.25);
});

// Reset BOT info_target spawns on round start.
// TODO: Remove when valve fixes the bot spawn bug.
Instance.OnRoundStart(ResetInfoTargetBotSpawns);

Instance.OnPlayerReset(({ player: playerPawn }) => {

    if (Instance.IsWarmupPeriod()) {
        // Don't give out hats in warmup
        return;
    }

    // TODO: Remove when valve fixes the bot spawn bug.
    SpawnBotOnInfoTargetFix(playerPawn);

    const newHatEntity = SpawnHat();
        
    if (newHatEntity) {

        AttachEntToPlayerEntHead(newHatEntity, playerPawn);
          
    }
    
});

// Drop hats on player death
Instance.OnPlayerKill(({ player: playerPawn }) => {

    if (Instance.IsWarmupPeriod()) {
        // Don't drop hats in warmup
        return;
    }
    
    DetachHatsFromPlayer(playerPawn);

});

// Spawns a default hat (and a point_soundevent that is parented to it) using a point_template entity
// The point_template entity points to a level0 hat model (prop_physics_multiplayer)
// We change the model here if necessery (it should not be)
function SpawnHat(level = 0) {

    const spawner = Instance.FindEntityByName(POINT_TEMPLATE_SPAWNER_ENTITY_NAME);

    if (spawner instanceof PointTemplate) {

        const spawnedEntitiesArr = spawner.ForceSpawn();

        if (spawnedEntitiesArr !== undefined) {

            const hatEnt = spawnedEntitiesArr[0];

            if (hatEnt instanceof BaseModelEntity) {

                hatEnt.SetColor(GetRandomColor());

                if (level > 0) {
                    const modelName = FormatHatModelName(level);
                    hatEnt.SetModel(modelName);
                }

                return hatEnt;

            }

        }

    }

    return null;

}

function AttachEntToPlayerEntHead(hatEnt, playerPawn) {

    hatEnt.SetParent(playerPawn); // Hat entity needs to be parented to the player entity first
    Instance.EntFireAtTarget({ target: hatEnt, input: "SetParentAttachment", value: "clip_limit" }); // And then SetParentAttachment will place it on the head

}

function GetAllHatEntities() {
    const hatEntities = Instance.FindEntitiesByName(PROP_PHYSICS_MULTIPLAYER_XMAS_HAT_ENTITY_NAME);
    return hatEntities;
}

function GetAllPlayerEntities() {
    const playerEntities = Instance.FindEntitiesByClass("player");
    return playerEntities;
}

function GetAllHatSpeakerEntities() {
    const speakerEntities = Instance.FindEntitiesByName(POINT_SOUNDEVENT_XMAS_HAT_ENTITY_NAME);
    return speakerEntities;
}

function FormatHatModelName(levelNum) {
    return "models/xmas_hat_minigame/xmas_hat_level" + levelNum + ".vmdl";
}

function GetRandomColor() {
    return {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
    };
}

function GetDistanceBetweenEntities(entity1, entity2) {

    const { x: pos1X, y: pos1Y, z: pos1Z } = entity1.GetAbsOrigin();
    const { x: pos2X, y: pos2Y, z: pos2Z } = entity2.GetAbsOrigin();

    const dx = pos2X - pos1X;
	const dy = pos2Y - pos1Y;
	const dz = pos2Z - pos1Z;

	const distUnits = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return distUnits;
    
}

function DetachHatsFromPlayer(playerPawn) {

    const hatEntities = GetAllHatEntities();

    for (const hatEntity of hatEntities) {
        
        const hatParent = hatEntity.GetParent();
        
        if (!hatParent) {
            continue;
        }

        if (hatParent.GetPlayerController() === playerPawn.GetPlayerController()) {

            hatEntity.SetModel(FormatHatModelName(0)); // Set all hats back to default model for simplicity
            hatEntity.SetParent(undefined);

            // TODO: use hatEntity.Teleport() to give them some randomness when they drop?
            
            if (DROPPED_HAT_GLOW_ENABLE) {
                if (playerPawn.GetTeamNumber() === TEAM_NUMBER_T) {
                    hatEntity.Glow(DROPPED_HAT_GLOW_COLOR_T);
                } else if (playerPawn.GetTeamNumber() === TEAM_NUMBER_CT) {
                    hatEntity.Glow(DROPPED_HAT_GLOW_COLOR_CT);
                }
            }

        }

    }
    
}

function HatPickupCheck() {

    if (Instance.IsWarmupPeriod()) {
        // Don't allow picking up hats during warmup
        return;
    }

    const hatEntities = GetAllHatEntities();
    const playerEntities = GetAllPlayerEntities();

    for (const hatEntity of hatEntities) {

        if (hatEntity.GetParent()) {
            // Hat is attached, dont take
            continue;
        }

        for (const playerEntity of playerEntities) {

            if (!playerEntity.IsAlive()) {
                // Dead players can't pick up hats
                continue;
            }

            const distUnits = GetDistanceBetweenEntities(hatEntity, playerEntity);

            if (distUnits < MAX_HAT_PICKUP_DISTANCE_UNITS) {

                

                // How many hats does the stealer have equiped
                let stealerHatCount = 0;
                for (const hatEntity of hatEntities) {
                    if (hatEntity.GetParent() === playerEntity) {
                        stealerHatCount++;
                    }
                }

                if (stealerHatCount >= MAX_HAT_STACK_COUNT) {
                    // Maximum amount of hat stack reached, can't pick up
                    continue;
                }

                const playerPawn = playerEntity.GetPlayerController().GetPlayerPawn();

                // Play pickup sound of hat about to be picked up
                const speakerEntities = GetAllHatSpeakerEntities();
                for (const speakerEnt of speakerEntities) {
                    if (speakerEnt.GetParent() === hatEntity) {
                        Instance.EntFireAtTarget({ target: speakerEnt, input: "StartSound" });
                    }
                }

                // Since our model names are 0 indexed, no need to increment/decrement anything here
                hatEntity.SetModel(FormatHatModelName(stealerHatCount));

                // Unglow the hat since its gonna be attached to a player now
                hatEntity.Unglow();

                // Finally, attach the hat to the new player
                AttachEntToPlayerEntHead(hatEntity, playerPawn);

            } else {

                // Instance.Msg("Cannot steal hat, too far away: " + distUnits);

            }
            
        }
        
    }
}

// Since there is a bug in CS2 that breaks bot spawns if we spawn
// entities through info_template, we have this hacky fix in place.
// It will check spawning players to see if they are bots, in the case they are
// they will be teleported to the first available info_point entity with a name defined in
// INFO_POINT_SPAWN_T_ENTITY_NAME & INFO_POINT_SPAWN_CT_ENTITY_NAME respectively.
function SpawnBotOnInfoTargetFix(playerPawn) {

    if (!playerPawn?.GetPlayerController()?.IsBot()) {
        return;
    }

    let botSpawnFixInfoTarget = null;
    if (playerPawn.GetTeamNumber() === TEAM_NUMBER_T) {
        botSpawnFixInfoTarget = Instance.FindEntityByName(INFO_POINT_SPAWN_T_ENTITY_NAME);
    } else if (playerPawn.GetTeamNumber() === TEAM_NUMBER_CT) {
        botSpawnFixInfoTarget = Instance.FindEntityByName(INFO_POINT_SPAWN_CT_ENTITY_NAME);
    }

    if (!botSpawnFixInfoTarget) {
        return;
    }

    const entityName = botSpawnFixInfoTarget.GetEntityName();
    botSpawnFixInfoTarget.SetEntityName(entityName + "_occupied");

    playerPawn.Teleport({
        position: botSpawnFixInfoTarget.GetAbsOrigin(),
        angles: botSpawnFixInfoTarget.GetAbsAngles()
    });

}

function ResetInfoTargetBotSpawns() {
    const tBotSpawnFixInfoTargets = Instance.FindEntitiesByName(INFO_POINT_SPAWN_T_ENTITY_NAME + "_occupied");
    const ctbotSpawnFixInfoTargets = Instance.FindEntitiesByName(INFO_POINT_SPAWN_CT_ENTITY_NAME + "_occupied");

    for (const tBotSpawnFixInfoTarget of tBotSpawnFixInfoTargets) {
        tBotSpawnFixInfoTarget.SetEntityName(INFO_POINT_SPAWN_T_ENTITY_NAME);
    }

    for (const ctBotSpawnFixInfoTarget of ctbotSpawnFixInfoTargets) {
        ctBotSpawnFixInfoTarget.SetEntityName(INFO_POINT_SPAWN_CT_ENTITY_NAME);
    }
}