// Camera class - because who doesn't want a first-person view for debugging?
class Camera {
    constructor() {
        // Movement settings - sometimes feels slower than waiting in line at the campus cafe
        this.moveSpeed = 0.2;
        this.turnSpeed = 3;
        this.collisionRadius = 0.15; // Enough space for a tall coffee to pass
        this.height = 1.8; // Standard human camera height (no giant or hobbit cameras allowed)

        // Our main vectors (just placeholders until we find a safe spawn)
        this.eye = new Vector3([0, 0, 0]);
        this.at = new Vector3([0, 0, -1]);
        this.up = new Vector3([0, 1, 0]);

        // Attempt to find a spot that won't drop us into the void
        this.setToSafeSpawn();
    }

    setToSafeSpawn() {
        // Hunt for a no-fall-damage zone
        const spawnPoint = this.findSafeSpawn();
        
        // Place camera's "eyes" above ground level
        this.eye.elements[0] = spawnPoint.x;
        this.eye.elements[1] = spawnPoint.y + this.height;
        this.eye.elements[2] = spawnPoint.z;

        // Make sure the camera isn't staring at the sky or its own feet
        this.at.elements[0] = spawnPoint.x;
        this.at.elements[1] = spawnPoint.y + this.height;
        this.at.elements[2] = spawnPoint.z - 1; // Just look forward, yeah?
    }

    findSafeSpawn() {
        // We'll do a neat spiral search until we find stable ground
        const centerX = 16; // Because 16 is the middle of 32, big surprise
        const centerZ = 16;
        const spiralDirs = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // Feels like a snail pattern
        let x = centerX;
        let z = centerZ;
        let dirIndex = 0;
        let stepSize = 1;
        let stepCount = 0;
        let segmentCount = 0;

        // Start spinning outward, crossing fingers for solid land
        while (x >= 0 && x < 32 && z >= 0 && z < 32) {
            // Checking for safety
            if (this.isSpawnSafe(x - 16, z - 16)) {
                // Found something that won't kill us. Great success!
                const y = this.getGroundLevel(x, z);
                return {
                    x: x - 16,
                    y: y,
                    z: z - 16
                };
            }

            // Keep on spiraling
            x += spiralDirs[dirIndex][0];
            z += spiralDirs[dirIndex][1];
            stepCount++;

            // When we've taken as many steps in one direction as needed, switch direction
            if (stepCount === stepSize) {
                stepCount = 0;
                dirIndex = (dirIndex + 1) % 4;
                segmentCount++;
                if (segmentCount === 2) {
                    segmentCount = 0;
                    stepSize++;
                }
            }
        }

        // If this code runs, no perfect spawn was found. Yeet us into the air!
        console.warn("No ideal spawn point found, using fallback position");
        return {
            x: 0,
            y: 10, // High enough to break ankles upon landing - oh well
            z: 0
        };
    }

    isSpawnSafe(worldX, worldZ) {
        // Convert from fancy world coords to our beloved map array indexes
        const mapX = Math.floor(worldX + 16);
        const mapZ = Math.floor(worldZ + 16);

        // Out of bounds? Hard fail
        if (mapX < 0 || mapX >= 32 || mapZ < 0 || mapZ >= 32) {
            return false;
        }

        // Check how tall the ground is
        const groundY = this.getGroundLevel(mapX, mapZ);
        
        // Where the camera's eyes end up
        const headY = groundY + this.height;

        // For safety reasons, we check for trees. Because running into a tree isn't fun
        if (g_treeSystem && g_treeSystem.treeLocations) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const checkX = mapX + dx;
                    const checkZ = mapZ + dz;
                    
                    // If there's a tree, let's not spawn inside it like a cartoon
                    const tree = g_treeSystem.treeLocations.find(t => 
                        t.x === checkX && t.z === checkZ
                    );
                    if (tree) return false; // That place is for the birds
                }
            }
        }
        
        // Finally, check if we won't collide with blocks at head level
        return !this.checkCollision(new Vector3([worldX, headY, worldZ]));
    }

    getGroundLevel(mapX, mapZ) {
        // A tiny offset so we're not half-stuck in blocks
        return g_map[mapX][mapZ] + 0.1;
    }

    checkCollision(position) {
        // We check around the position in a small 3D volume
        const margin = 0.2; // Enough wiggle room to not glitch into walls
        const verticalMargin = 0.3;
        // Checking corners, top, bottom... basically any place you might get jammed
        const checkPoints = [
            [0, 0, 0],
            [margin, -verticalMargin, margin],
            [margin, -verticalMargin, -margin],
            [-margin, -verticalMargin, margin],
            [-margin, -verticalMargin, -margin],
            [margin, verticalMargin, margin],
            [margin, verticalMargin, -margin],
            [-margin, verticalMargin, margin],
            [-margin, verticalMargin, -margin],
            [margin, 0, 0],
            [-margin, 0, 0],
            [0, verticalMargin, 0],
            [0, -verticalMargin, 0],
            [0, 0, margin],
            [0, 0, -margin]
        ];

        // Check each of those points for collisions
        for (let point of checkPoints) {
            const checkPos = new Vector3([
                position.elements[0] + point[0],
                position.elements[1] + point[1],
                position.elements[2] + point[2]
            ]);

            // Convert to map indexes
            const mapX = Math.floor(checkPos.elements[0] + 16);
            const mapY = Math.floor(checkPos.elements[1] + 0.5);
            const mapZ = Math.floor(checkPos.elements[2] + 16);

            // If out of range, we can just treat that like a collision
            if (mapX < 0 || mapX >= 32 || mapZ < 0 || mapZ >= 32) {
                return true;
            }

            // Check if the terrain is too tall at this spot
            if (mapY >= 0 && g_map[mapX] && g_map[mapX][mapZ] > mapY) {
                return true;
            }

            // Also watch out for trees. We don't want to glitch through them either
            if (g_treeSystem && g_treeSystem.treeLocations) {
                for (let tree of g_treeSystem.treeLocations) {
                    // Is this point inside the trunk?
                    if (mapX === tree.x && mapZ === tree.z) {
                        const trunkTop = tree.y + tree.trunkHeight;
                        if (mapY >= tree.y && mapY < trunkTop) {
                            // Double check we're inside the trunk's radius
                            const trunkMargin = 0.3;
                            const trunkX = tree.x - 16 + 0.5; // approximate center
                            const trunkZ = tree.z - 16 + 0.5;
                            const dx = Math.abs(checkPos.elements[0] - trunkX);
                            const dz = Math.abs(checkPos.elements[2] - trunkZ);
                            
                            if (dx < trunkMargin && dz < trunkMargin) {
                                return true; // We are indeed inside a tree trunk. Ouch.
                            }
                        }
                    }
                }
            }
        }

        // If we got this far, apparently we fit comfortably
        return false;
    }

    canMoveTo(newPosition) {
        // Let's see if we can step onto some new block or up a slope
        let adjustedPosition = new Vector3(newPosition.elements);
        
        const currentX = Math.floor(this.eye.elements[0] + 16);
        const currentZ = Math.floor(this.eye.elements[2] + 16);
        const targetX = Math.floor(adjustedPosition.elements[0] + 16);
        const targetZ = Math.floor(adjustedPosition.elements[2] + 16);

        // If we're moving into a different block zone, let's see if we need a small climb
        if (currentX !== targetX || currentZ !== targetZ) {
            if (targetX >= 0 && targetX < 32 && targetZ >= 0 && targetZ < 32) {
                const currentHeight = g_map[currentX][currentZ];
                const targetHeight = g_map[targetX][targetZ];
                
                // Checking if there's a tree trunk that might be taller than the ground
                let treeHeight = 0;
                if (g_treeSystem && g_treeSystem.trees) {
                    const tree = g_treeSystem.trees.find(t => t.x === targetX && t.z === targetZ);
                    if (tree) {
                        treeHeight = tree.y + tree.trunkHeight;
                    }
                }
                
                // The actual height we need to climb
                const effectiveTargetHeight = Math.max(targetHeight, treeHeight);
                if (effectiveTargetHeight > currentHeight) {
                    // We'll do a small vertical shift so we don't faceplant into the block
                    adjustedPosition.elements[1] += 0.2 * (effectiveTargetHeight - currentHeight);
                }
            }
        }

        // Checking collisions for the final adjusted position
        if (!this.checkCollision(adjustedPosition)) {
            // If no collision, it's safe to proceed
            newPosition.elements[1] = adjustedPosition.elements[1];
            return true;
        }

        // Sorry, there's a big chunk in the way
        return false;
    }

    moveForward() {
        // Let's move along the forward vector
        let forward = new Vector3();
        forward.set(this.at);
        forward.sub(this.eye);
        forward.normalize();
        forward.mul(this.moveSpeed);

        // Potential new location
        let newEye = new Vector3();
        newEye.set(this.eye);
        newEye.add(forward);

        // If it's not blocked, let's do it
        if (this.canMoveTo(newEye)) {
            this.eye.add(forward);
            this.at.add(forward);
        }
    }

    moveBackward() {
        // The backward vector is basically the negative forward
        let backward = new Vector3();
        backward.set(this.eye);
        backward.sub(this.at);
        backward.normalize();
        backward.mul(this.moveSpeed);

        let newEye = new Vector3();
        newEye.set(this.eye);
        newEye.add(backward);

        // Check if we can safely go back
        if (this.canMoveTo(newEye)) {
            this.eye.add(backward);
            this.at.add(backward);
        }
    }

    moveLeft() {
        // Cross product with up vector to get a left vector
        let forward = new Vector3();
        forward.set(this.at);
        forward.sub(this.eye);
        
        let left = Vector3.cross(this.up, forward);
        left.normalize();
        left.mul(this.moveSpeed);

        let newEye = new Vector3();
        newEye.set(this.eye);
        newEye.add(left);

        // If no collisions, slide left
        if (this.canMoveTo(newEye)) {
            this.eye.add(left);
            this.at.add(left);
        }
    }

    moveRight() {
        // Cross with up in the opposite order for right vector
        let forward = new Vector3();
        forward.set(this.at);
        forward.sub(this.eye);
        
        let right = Vector3.cross(forward, this.up);
        right.normalize();
        right.mul(this.moveSpeed);

        let newEye = new Vector3();
        newEye.set(this.eye);
        newEye.add(right);

        // If no collisions, slide right
        if (this.canMoveTo(newEye)) {
            this.eye.add(right);
            this.at.add(right);
        }
    }

    rotateYaw(angle) {
        // Rotate around the up axis to turn
        let forward = new Vector3();
        forward.set(this.at);
        forward.sub(this.eye);
        forward.normalize();

        let rotMatrix = new Matrix4();
        rotMatrix.setRotate(angle, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
        
        let rotated = rotMatrix.multiplyVector3(forward);
        this.at.set(this.eye);
        this.at.add(rotated);
    }

    pitch(angle) {
        // Pitch uses the cross product to figure out the 'right' axis
        let forward = new Vector3();
        forward.set(this.at);
        forward.sub(this.eye);
        forward.normalize();

        let right = Vector3.cross(forward, this.up);
        right.normalize();

        let rotMatrix = new Matrix4();
        rotMatrix.setRotate(angle, right.elements[0], right.elements[1], right.elements[2]);

        // Gently tilt our camera
        let rotatedForward = rotMatrix.multiplyVector3(forward);
        rotatedForward.normalize();

        // Don't look too far up/down, or you'll break your neck
        let dot = Vector3.dot(rotatedForward, this.up);
        if (Math.abs(dot) > 0.98) return;

        this.at.set(this.eye);
        this.at.add(rotatedForward);
    }

    lookAround(deltaX, deltaY) {
        // For mouse movements or trackpad, let's rotate accordingly
        const sensitivity = 0.1;
        this.rotateYaw(-deltaX * sensitivity);
        this.pitch(-deltaY * sensitivity);
    }

    turnLeft() {
        // Typical left turn, like turning left to your coffee in the morning
        this.rotateYaw(this.turnSpeed);
    }

    turnRight() {
        // Or looking over your right shoulder for that friend who’s always late
        this.rotateYaw(-this.turnSpeed);
    }
}
