// Another late-night coding session. Fuel: coffee and determination.
class BlockSystem {
    constructor(worldMap) {
        this.worldMap = worldMap;
        this.maxDistance = 5; // Maximum reach distance (if only my bed was this close!)
        this.selectedBlock = null; // The block currently in the spotlight
    }

    raycast(camera) {
        // Setting up our origin & direction vectors for the ray
        const rayOrigin = new Vector3(camera.eye.elements);
        const rayDirection = new Vector3();
        
        // The direction the player is looking at
        rayDirection.set(camera.at);
        rayDirection.sub(camera.eye);
        rayDirection.normalize();

        // We'll move the ray forward in small steps
        let currentPos = new Vector3(rayOrigin.elements);
        const step = 0.1; // Tiptoe forward to find that block

        // Checking each small step until we hit a block or go out of range
        for (let dist = 0; dist < this.maxDistance; dist += step) {
            currentPos.elements[0] = rayOrigin.elements[0] + rayDirection.elements[0] * dist;
            currentPos.elements[1] = rayOrigin.elements[1] + rayDirection.elements[1] * dist;
            currentPos.elements[2] = rayOrigin.elements[2] + rayDirection.elements[2] * dist;

            // The floor() method ensures we're referencing valid indexes in the array
            const mapX = Math.floor(currentPos.elements[0] + 16);
            const mapY = Math.floor(currentPos.elements[1] + 0.5);
            const mapZ = Math.floor(currentPos.elements[2] + 16);

            // Make sure we don't do any out-of-bounds array errors (my professor hates that)
            if (mapX >= 0 && mapX < 32 && mapZ >= 0 && mapZ < 32 && mapY >= 0) {
                // Check if we’ve hit a solid block
                if (mapY < this.worldMap[mapX][mapZ]) {
                    return {
                        x: mapX,
                        y: mapY,
                        z: mapZ,
                        face: this.getHitFace(currentPos, rayDirection),
                        worldPos: currentPos
                    };
                }
            }
        }
        // If we made it here, we didn't hit anything (just empty space).
        return null;
    }

    getHitFace(hitPos, rayDir) {
        // Find position within the block (local coordinates)
        const localX = hitPos.elements[0] - Math.floor(hitPos.elements[0]);
        const localY = hitPos.elements[1] - Math.floor(hitPos.elements[1]);
        const localZ = hitPos.elements[2] - Math.floor(hitPos.elements[2]);

        // Determining which face we collided with (honestly, I just guess and check)
        if (localX < 0.01 && rayDir.elements[0] > 0) return 'left';
        if (localX > 0.99 && rayDir.elements[0] < 0) return 'right';
        if (localY < 0.01 && rayDir.elements[1] > 0) return 'bottom';
        if (localY > 0.99 && rayDir.elements[1] < 0) return 'top';
        if (localZ < 0.01 && rayDir.elements[2] > 0) return 'front';
        if (localZ > 0.99 && rayDir.elements[2] < 0) return 'back';
        
        // If all else fails, let's just say 'top' — classic fallback
        return 'top';
    }

    addBlock(camera) {
        // Let's see if we actually hit a block
        const hit = this.raycast(camera);
        if (!hit) return false;

        // Determine where to place the new block relative to the face we hit
        let newX = hit.x;
        let newY = hit.y;
        let newZ = hit.z;

        switch(hit.face) {
            case 'left':   newX -= 1; break;
            case 'right':  newX += 1; break;
            case 'bottom': newY -= 1; break;
            case 'top':    newY += 1; break;
            case 'front':  newZ -= 1; break;
            case 'back':   newZ += 1; break;
        }

        // Double-check that the new block is in a valid place
        if (newX >= 0 && newX < 32 && newZ >= 0 && newZ < 32 && newY >= 0) {
            // If it's above the current height, we can add a new block on top
            if (newY > this.worldMap[newX][newZ] - 1) {
                this.worldMap[newX][newZ] = newY + 1;
                return true;
            }
        }
        // If we get here, adding didn't work — maybe next time!
        return false;
    }

    removeBlock(camera) {
        // Raycast to find the block we'd like to delete
        const hit = this.raycast(camera);
        if (!hit) return false;

        // No underground or bottom-layer block removal, or the map will look funky
        if (hit.y <= 0 || hit.y < g_heightMap[hit.x][hit.z]) return false;

        // Make sure we're only removing the top block (no floating blocks allowed)
        if (hit.y === this.worldMap[hit.x][hit.z] - 1) {
            this.worldMap[hit.x][hit.z]--;
            return true;
        }

        // If none of the conditions matched, well, can't remove that block
        return false;
    }
}
