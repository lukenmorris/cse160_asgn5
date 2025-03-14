// TreeSystem.js
class TreeSystem {
    constructor() {
        // Tree blocks will use separate buffers for better performance
        this.trunkVertices = [];
        this.trunkUVs = [];
        this.leavesVertices = [];
        this.leavesUVs = [];
        this.treeLocations = []; // Store tree positions for collision detection
    }

    generateTrees(worldMap) {
        console.log('Generating trees...');
        const treeChance = 0.1; // 10% chance of tree on each valid block
        
        for (let x = 1; x < 31; x++) { // Keep trees away from world edges
            for (let z = 1; z < 31; z++) {
                // Only place trees on grass blocks with space above
                if (Math.random() < treeChance && 
                    this.canPlaceTree(x, z, worldMap)) {
                    this.generateTree(x, worldMap[x][z], z);
                }
            }
        }

        // Convert to typed arrays for WebGL
        this.trunkBufferData = new Float32Array(this.trunkVertices);
        this.trunkUVBufferData = new Float32Array(this.trunkUVs);
        this.leavesBufferData = new Float32Array(this.leavesVertices);
        this.leavesUVBufferData = new Float32Array(this.leavesUVs);
    }

    canPlaceTree(x, z, worldMap) {
        // Check if there's enough space for a tree
        const baseHeight = worldMap[x][z];
        
        // Check surrounding blocks to avoid trees too close together
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (this.treeLocations.some(tree => 
                    tree.x === x + dx && tree.z === z + dz)) {
                    return false;
                }
            }
        }

        // Ensure we have room for the trunk and leaves
        return baseHeight + 5 < 16; // Maximum world height
    }

    generateTree(x, baseY, z) {
        const trunkHeight = 3 + Math.floor(Math.random() * 2); // 3-4 blocks tall
        this.treeLocations.push({x, y: baseY, z, trunkHeight});

        // Generate trunk
        for (let y = 0; y < trunkHeight; y++) {
            this.addCube(
                x - 16, // Convert to world coordinates
                baseY + y,
                z - 16,
                this.trunkVertices,
                this.trunkUVs
            );
        }

        // Generate leaves (in a roughly spherical pattern)
        const leavesPattern = [
            // Layer 1 (bottom)
            [{x: 0, y: 0, z: 0}],
            // Layer 2 (middle)
            [{x: -1, y: 0, z: 0}, {x: 1, y: 0, z: 0},
             {x: 0, y: 0, z: -1}, {x: 0, y: 0, z: 1}],
            // Layer 3 (top)
            [{x: 0, y: 1, z: 0}]
        ];

        const leavesBaseY = baseY + trunkHeight - 1;
        leavesPattern.forEach((layer, layerY) => {
            layer.forEach(block => {
                this.addCube(
                    x + block.x - 16,
                    leavesBaseY + block.y,
                    z + block.z - 16,
                    this.leavesVertices,
                    this.leavesUVs
                );
            });
        });
    }

    addCube(x, y, z, verticesArray, uvsArray) {
        // Standard cube vertices relative to position
        const cube = new Cube();
        const verts = cube.vertices;
        const uvs = cube.uvCoords;

        // Add vertices with position offset
        for (let i = 0; i < verts.length; i += 3) {
            verticesArray.push(
                verts[i] + x,
                verts[i+1] + y - 0.5,
                verts[i+2] + z
            );
        }

        // Add UVs
        uvsArray.push(...uvs);
    }

    setupBuffers(gl) {
        // Create and fill trunk buffers
        this.trunkVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.trunkVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.trunkBufferData, gl.STATIC_DRAW);

        this.trunkUVBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.trunkUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.trunkUVBufferData, gl.STATIC_DRAW);

        // Create and fill leaves buffers
        this.leavesVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.leavesVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.leavesBufferData, gl.STATIC_DRAW);

        this.leavesUVBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.leavesUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.leavesUVBufferData, gl.STATIC_DRAW);
    }

    render(gl, a_Position, a_UV, a_Normal, u_whichTexture) {
        // Generate normals for tree trunks (pointing outward)
        const trunkNormals = new Float32Array(this.trunkBufferData.length);
        for (let i = 0; i < trunkNormals.length; i += 9) {
            // Simple approach - each face has appropriate normal
            // Front face (z+) normals
            if ((i % 36) < 18) {
                for (let j = 0; j < 3; j++) {
                    trunkNormals[i + j*3] = 0;
                    trunkNormals[i + j*3 + 1] = 0;
                    trunkNormals[i + j*3 + 2] = 1;
                }
            }
            // Back face (z-) normals
            else if ((i % 36) < 36 && (i % 36) >= 18) {
                for (let j = 0; j < 3; j++) {
                    trunkNormals[i + j*3] = 0;
                    trunkNormals[i + j*3 + 1] = 0;
                    trunkNormals[i + j*3 + 2] = -1;
                }
            }
            // Top face (y+) normals
            else if ((i % 36) >= 36 && (i % 36) < 54) {
                for (let j = 0; j < 3; j++) {
                    trunkNormals[i + j*3] = 0;
                    trunkNormals[i + j*3 + 1] = 1;
                    trunkNormals[i + j*3 + 2] = 0;
                }
            }
            // Bottom face (y-) normals
            else if ((i % 36) >= 54 && (i % 36) < 72) {
                for (let j = 0; j < 3; j++) {
                    trunkNormals[i + j*3] = 0;
                    trunkNormals[i + j*3 + 1] = -1;
                    trunkNormals[i + j*3 + 2] = 0;
                }
            }
            // Right face (x+) normals
            else if ((i % 36) >= 72 && (i % 36) < 90) {
                for (let j = 0; j < 3; j++) {
                    trunkNormals[i + j*3] = 1;
                    trunkNormals[i + j*3 + 1] = 0;
                    trunkNormals[i + j*3 + 2] = 0;
                }
            }
            // Left face (x-) normals
            else {
                for (let j = 0; j < 3; j++) {
                    trunkNormals[i + j*3] = -1;
                    trunkNormals[i + j*3 + 1] = 0;
                    trunkNormals[i + j*3 + 2] = 0;
                }
            }
        }
        
        // Generate normals for leaves (spherical)
        const leavesNormals = new Float32Array(this.leavesBufferData.length);
        for (let i = 0; i < leavesNormals.length; i += 9) {
            // For leaves, we'll try to create a more spherical appearance
            // by having normals point outward from the center of the leaf block
            for (let j = 0; j < 3; j++) {
                const vx = this.leavesBufferData[i + j*3];
                const vy = this.leavesBufferData[i + j*3 + 1];
                const vz = this.leavesBufferData[i + j*3 + 2];
                
                // Find the center of the current leaf block
                const cx = Math.floor(vx) + 0.5;
                const cy = Math.floor(vy) + 0.5;
                const cz = Math.floor(vz) + 0.5;
                
                // Calculate direction from center
                let nx = vx - cx;
                let ny = vy - cy;
                let nz = vz - cz;
                
                // Normalize
                const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
                leavesNormals[i + j*3] = nx / len;
                leavesNormals[i + j*3 + 1] = ny / len;
                leavesNormals[i + j*3 + 2] = nz / len;
            }
        }
        
        // Draw tree trunks
        gl.uniform1i(u_whichTexture, 3); // Assuming texture 3 is wood
        
        // Create normal buffer for trunks
        let normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, trunkNormals, gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Normal);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.trunkVertexBuffer);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.trunkUVBuffer);
        gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, this.trunkBufferData.length / 3);

        // Draw leaves
        gl.uniform1i(u_whichTexture, 4); // Assuming texture 4 is leaves
        
        // Create normal buffer for leaves
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, leavesNormals, gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.leavesVertexBuffer);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.leavesUVBuffer);
        gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, this.leavesBufferData.length / 3);
    }
}