// Updated Vertex shader program
var VSHADER_SOURCE = `
    precision mediump float;
    attribute vec4 a_Position;
    attribute vec2 a_UV;
    attribute vec3 a_Normal;  // Added normal attribute
    
    varying vec2 v_UV;
    varying vec3 v_Normal;    // Pass normal to fragment shader
    varying vec3 v_WorldPos;  // Pass world position to fragment shader
    
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_GlobalRotateMatrix;
    uniform mat4 u_ViewMatrix;
    uniform mat4 u_ProjectionMatrix;
    
    void main() {
        // Calculate position
        gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
        
        // Pass UV coordinates
        v_UV = a_UV;
        
        // Calculate world position (for lighting)
        v_WorldPos = (u_ModelMatrix * a_Position).xyz;
        
        // Transform normal to world space (simplified - assumes uniform scaling)
        v_Normal = mat3(u_ModelMatrix) * a_Normal;
    }`;

// Updated Fragment shader program
var FSHADER_SOURCE = `
    precision mediump float;
    varying vec2 v_UV;
    varying vec3 v_Normal;      // Received from vertex shader
    varying vec3 v_WorldPos;    // World position for lighting
    
    uniform vec4 u_FragColor;
    uniform sampler2D u_Sampler0;
    uniform sampler2D u_Sampler1;
    uniform sampler2D u_Sampler2;
    uniform sampler2D u_Sampler3;
    uniform sampler2D u_Sampler4;
    uniform int u_whichTexture;
    
    // Lighting uniforms
    uniform bool u_LightingEnabled;      // Toggle lighting
    uniform bool u_NormalVisualization;  // Toggle normal visualization
    uniform vec3 u_LightPosition;        // Point light position
    uniform vec3 u_LightColor;           // Light color
    uniform vec3 u_ViewPosition;         // Camera position for specular
    
    // Spotlight uniforms
    uniform bool u_SpotlightEnabled;      // Toggle spotlight
    uniform vec3 u_SpotlightPosition;     // Spotlight position
    uniform vec3 u_SpotlightDirection;    // Spotlight direction
    uniform float u_SpotlightCutoff;      // Spotlight cutoff angle (cosine)
    
    // Phong model constants
    const float ambientStrength = 0.2;
    const float diffuseStrength = 0.7;
    const float specularStrength = 0.5;
    const float shininess = 32.0;
    
    void main() {
        // Get base color/texture
        vec4 baseColor;
        if (u_whichTexture == -2) {
            baseColor = u_FragColor;
        } else if (u_whichTexture == 0) {
            baseColor = texture2D(u_Sampler0, v_UV); // Sky
        } else if (u_whichTexture == 1) {
            baseColor = texture2D(u_Sampler1, v_UV); // Dirt
        } else if (u_whichTexture == 2) {
            baseColor = texture2D(u_Sampler2, v_UV); // Grass
        } else if (u_whichTexture == 3) {
            baseColor = texture2D(u_Sampler3, v_UV); // Wood
        } else if (u_whichTexture == 4) {
            baseColor = texture2D(u_Sampler4, v_UV); // Leaves
        } else {
            baseColor = vec4(1, 1, 1, 1);
        }
        
        // If normal visualization is enabled, just show the normal
        if (u_NormalVisualization) {
            // Convert normal to RGB color (normalized to 0-1 range)
            gl_FragColor = vec4(normalize(v_Normal) * 0.5 + 0.5, 1.0);
            return;
        }
        
        // If lighting is disabled, just use the base color
        if (!u_LightingEnabled) {
            gl_FragColor = baseColor;
            return;
        }
        
        // Normalize the normal vector
        vec3 normal = normalize(v_Normal);
        
        // Calculate lighting
        vec3 lightColor = u_LightColor;
        
        // Ambient component
        vec3 ambient = ambientStrength * lightColor;
        
        // Initialize result with ambient lighting
        vec3 result = ambient;
        
        // Point light calculation (if enabled)
        {
            // Calculate light direction
            vec3 lightDir = normalize(u_LightPosition - v_WorldPos);
            
            // Diffuse component
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diffuseStrength * diff * lightColor;
            
            // Specular component
            vec3 viewDir = normalize(u_ViewPosition - v_WorldPos);
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
            vec3 specular = specularStrength * spec * lightColor;
            
            // Add point light contribution
            result += diffuse + specular;
        }
        
        // Spotlight calculation (if enabled)
        if (u_SpotlightEnabled) {
            vec3 spotlightDir = normalize(u_SpotlightPosition - v_WorldPos);
            float theta = dot(spotlightDir, normalize(-u_SpotlightDirection));
            
            if (theta > u_SpotlightCutoff) {
                // Calculate intensity based on angle
                float intensity = (theta - u_SpotlightCutoff) / (1.0 - u_SpotlightCutoff);
                
                // Diffuse for spotlight
                float diff = max(dot(normal, spotlightDir), 0.0);
                vec3 diffuse = diffuseStrength * diff * lightColor * intensity;
                
                // Specular for spotlight
                vec3 viewDir = normalize(u_ViewPosition - v_WorldPos);
                vec3 reflectDir = reflect(-spotlightDir, normal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
                vec3 specular = specularStrength * spec * lightColor * intensity;
                
                // Add spotlight contribution
                result += diffuse + specular;
            }
        }
        
        // Apply lighting to base color
        gl_FragColor = vec4(result * baseColor.rgb, baseColor.a);
    }`;

// Global Variables
let g_fpsCounter;
let canvas;
let gl;
let a_Position;
let a_UV;
let u_FragColor;
let u_ModelMatrix;
let u_GlobalRotateMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let u_Sampler0;
let u_Sampler1;
let u_Sampler2;
let u_whichTexture;
let g_camera;

// Add these global variables to the top of World.js
let a_Normal;
let u_LightPosition;
let u_SpotlightPosition;
let u_SpotlightDirection;
let u_SpotlightCutoff;
let u_LightColor;
let u_ViewPosition;
let u_LightingEnabled;
let u_SpotlightEnabled;
let u_NormalVisualization;

// Add light and sphere objects
let g_lightCube;
let g_spotlight;
let g_lightSphere;
let g_demoSphere;
let g_lightAngle = 0;
let g_lightingEnabled = true;
let g_spotlightEnabled = false;
let g_normalVisualization = false;
let g_lightColor = [1.0, 1.0, 1.0]; // White light

let g_mouseDown = false;
let g_lastMouseX = 0;
let g_lastMouseY = 0;

let g_blockSystem;
let g_treeSystem;

let g_dirtVertexBuffer, g_dirtUVBuffer, g_grassVertexBuffer, g_grassUVBuffer;
let g_dirtVertices, g_dirtUVs, g_grassVertices, g_grassUVs;

function setupBuffers() {
    console.log('Setting up WebGL buffers...');
    
    // Dirt buffers
    g_dirtVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_dirtVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_dirtVertices, gl.STATIC_DRAW);

    g_dirtUVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_dirtUVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_dirtUVs, gl.STATIC_DRAW);

    // Grass buffers
    g_grassVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_grassVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_grassVertices, gl.STATIC_DRAW);

    g_grassUVBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, g_grassUVBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_grassUVs, gl.STATIC_DRAW);
}

// Add to global variables
let g_heightMap;  // Store original Perlin heights

function initializeMap() {
    console.log('Initializing world with Perlin noise...');
    noise.seed(Math.random());
    let noiseScale = 0.1;
    g_map = new Array(32);
    g_heightMap = new Array(32);  // Store original heights

    // First pass: generate heights
    for (let x = 0; x < 32; x++) {
        g_map[x] = new Array(32);
        g_heightMap[x] = new Array(32);
        for (let z = 0; z < 32; z++) {
            let height = Math.floor(3 * noise.simplex2(x * noiseScale, z * noiseScale)) + 2;
            height = Math.max(1, Math.min(height, 4));
            g_map[x][z] = height;
            g_heightMap[x][z] = height;  // Store original height
        }
    }

    updateWorldGeometry();
}

// New function to update geometry
function updateWorldGeometry() {
    // Arrays to collect geometry data
    let dirtVertices = [];
    let dirtUVs = [];
    let grassVertices = [];
    let grassUVs = [];

    // Generate geometry based on current g_map
    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let height = g_map[x][z];

            for (let y = 0; y < height; y++) {
                const isBaseLayer = (y === 0);  // Bottom layer is always grass
                const tx = x - 16;
                const ty = y - 0.5;
                const tz = z - 16;

                // Get cube geometry
                const cube = new Cube();
                const verts = cube.vertices;
                const uvs = cube.uvCoords;

                // Process vertices
                for (let i = 0; i < verts.length; i += 3) {
                    const xPos = verts[i] + tx;
                    const yPos = verts[i+1] + ty;
                    const zPos = verts[i+2] + tz;
                    
                    if (isBaseLayer) {
                        grassVertices.push(xPos, yPos, zPos);
                    } else {
                        dirtVertices.push(xPos, yPos, zPos);
                    }
                }

                // Process UVs
                if (isBaseLayer) {
                    grassUVs.push(...uvs);
                } else {
                    dirtUVs.push(...uvs);
                }
            }
        }
    }

    // Convert to Float32Arrays
    g_dirtVertices = new Float32Array(dirtVertices);
    g_dirtUVs = new Float32Array(dirtUVs);
    g_grassVertices = new Float32Array(grassVertices);
    g_grassUVs = new Float32Array(grassUVs);
}


function setupWebGL() {
    console.log('Setting up WebGL...');
    canvas = document.getElementById('webgl');
    if (!canvas) {
        console.error('Failed to get canvas element');
        return;
    }
    console.log('Canvas element found:', canvas);

    gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) {
        console.error('Failed to get WebGL context');
        return;
    }
    console.log('WebGL context created successfully');

    gl.enable(gl.DEPTH_TEST);
    console.log('Depth testing enabled');
}

function connectVariablesToGLSL() {
    console.log('Connecting variables to GLSL...');

    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.error('Failed to initialize shaders');
        return;
    }
    console.log('Shaders initialized successfully');

    // Get attributes and uniforms
    a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    a_UV = gl.getAttribLocation(gl.program, 'a_UV');
    a_Normal = gl.getAttribLocation(gl.program, 'a_Normal'); // New normal attribute

    u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
    u_SpotlightPosition = gl.getUniformLocation(gl.program, 'u_SpotlightPosition');
    u_SpotlightDirection = gl.getUniformLocation(gl.program, 'u_SpotlightDirection');
    u_SpotlightCutoff = gl.getUniformLocation(gl.program, 'u_SpotlightCutoff');
    u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
    u_ViewPosition = gl.getUniformLocation(gl.program, 'u_ViewPosition');
    u_LightingEnabled = gl.getUniformLocation(gl.program, 'u_LightingEnabled');
    u_SpotlightEnabled = gl.getUniformLocation(gl.program, 'u_SpotlightEnabled');
    u_NormalVisualization = gl.getUniformLocation(gl.program, 'u_NormalVisualization');

    if (!u_LightPosition || !u_SpotlightPosition || !u_SpotlightDirection || 
        !u_SpotlightCutoff || !u_LightColor || !u_ViewPosition || 
        !u_LightingEnabled || !u_SpotlightEnabled || !u_NormalVisualization) {
        console.error('Failed to get lighting uniform locations');
    }
    
    // Get uniform locations
    u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
    if (!u_FragColor) {
        console.log('Failed to get the storage location of u_FragColor');
        return;
    }

    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    if (!u_ModelMatrix) {
        console.log('Failed to get the storage location of u_ModelMatrix');
        return;
    }

    u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
    if (!u_GlobalRotateMatrix) {
        console.log('Failed to get the storage location of u_GlobalRotateMatrix');
        return;
    }

    u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    if (!u_ViewMatrix) {
        console.log('Failed to get the storage location of u_ViewMatrix');
        return;
    }

    u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
    if (!u_ProjectionMatrix) {
        console.log('Failed to get the storage location of u_ProjectionMatrix');
        return;
    }

    u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
    if (!u_Sampler0) {
        console.log('Failed to get the storage location of u_Sampler0');
        return;
    }

    u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
    if (!u_Sampler1) {
        console.log('Failed to get the storage location of u_Sampler1');
        return;
    }

    u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
    if (!u_Sampler2) {
        console.log('Failed to get the storage location of u_Sampler2');
        return;
    }

    u_Sampler3 = gl.getUniformLocation(gl.program, 'u_Sampler3');
    if (!u_Sampler3) {
        console.log('Failed to get the storage location of u_Sampler3');
        return;
    }

    u_Sampler4 = gl.getUniformLocation(gl.program, 'u_Sampler4');
    if (!u_Sampler4) {
        console.log('Failed to get the storage location of u_Sampler4');
        return;
    }

    u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
    if (!u_whichTexture) {
        console.log('Failed to get the storage location of u_whichTexture');
        return;
    }

    // Check for errors
    if (!u_FragColor || !u_ModelMatrix || !u_GlobalRotateMatrix || !u_ViewMatrix || 
        !u_ProjectionMatrix || !u_Sampler0 || !u_Sampler1 || !u_Sampler2 || !u_whichTexture) {
        console.error('Failed to get uniform locations');
        return;
    }

    console.log('All variables connected successfully');
}

function initializeLighting() {
    // Create light cube (to represent point light position)
    g_lightCube = new Cube();
    g_lightCube.color = [1.0, 1.0, 0.0, 1.0]; // Yellow cube for the light
    g_lightCube.matrix.scale(0.2, 0.2, 0.2); // Make it small
    
    // Create spotlight cube (to represent spotlight position)
    g_spotlight = new Cube();
    g_spotlight.color = [0.0, 1.0, 1.0, 1.0]; // Cyan cube for the spotlight
    g_spotlight.matrix.scale(0.2, 0.2, 0.2); // Make it small
    
    // Create demonstration sphere
    g_demoSphere = new Sphere(1.0, 20);
    g_demoSphere.color = [0.8, 0.2, 0.2, 1.0]; // Red sphere
    g_demoSphere.matrix.translate(0, 3, 0); // Position it above ground
}

function setupLightingEventListeners() {
    // Add event listeners for the static controls
    document.getElementById('toggleLighting').addEventListener('click', function() {
        g_lightingEnabled = !g_lightingEnabled;
        this.textContent = g_lightingEnabled ? 'Turn Off Lighting' : 'Turn On Lighting';
    });
    
    document.getElementById('toggleNormals').addEventListener('click', function() {
        g_normalVisualization = !g_normalVisualization;
        this.textContent = g_normalVisualization ? 'Hide Normals' : 'Show Normals';
    });
    
    document.getElementById('toggleSpotlight').addEventListener('click', function() {
        g_spotlightEnabled = !g_spotlightEnabled;
        this.textContent = g_spotlightEnabled ? 'Turn Off Spotlight' : 'Turn On Spotlight';
    });
    
    document.getElementById('lightColor').addEventListener('input', function() {
        // Convert hex color to RGB (0-1 range)
        const hex = this.value.substring(1); // Remove #
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        g_lightColor = [r, g, b];
    });
}

function initTextures() {
    console.log('Initializing textures...');

    // Sky texture
    let skyImage = new Image();
    skyImage.onload = function() { 
        console.log('Sky texture loaded successfully');
        sendImageToTexture(skyImage, 0); 
    };
    skyImage.onerror = function() {
        console.error('Failed to load sky texture');
    };
    skyImage.src = 'sky.png';

    // Dirt texture
    let dirtImage = new Image();
    dirtImage.onload = function() { 
        console.log('Dirt texture loaded successfully');
        sendImageToTexture(dirtImage, 1); 
    };
    dirtImage.onerror = function() {
        console.error('Failed to load dirt texture');
    };
    dirtImage.src = 'dirt.png';

    // Grass texture
    let grassImage = new Image();
    grassImage.onload = function() { 
        console.log('Grass texture loaded successfully');
        sendImageToTexture(grassImage, 2); 
    };
    grassImage.onerror = function() {
        console.error('Failed to load grass texture');
    };
    grassImage.src = 'grass.png';

        // Add to initTextures()
    let woodImage = new Image();
    woodImage.onload = function() {
        console.log('Wood texture loaded successfully');
        sendImageToTexture(woodImage, 3);
    };
    woodImage.src = 'wood.jpg';

    let leavesImage = new Image();
    leavesImage.onload = function() {
        console.log('leaves texture loaded successfully');
        sendImageToTexture(leavesImage, 4);
    };
    leavesImage.src = 'leaf.png';
}

function sendImageToTexture(image, texNum) {
    console.log(`Setting up texture ${texNum}...`);
    let texture = gl.createTexture();
    if (!texture) {
        console.error(`Failed to create texture ${texNum}`);
        return;
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0 + texNum);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(eval(`u_Sampler${texNum}`), texNum);
    console.log(`Texture ${texNum} set up successfully`);
}

function drawMap() {
    // identity matrix
    const identityMat = new Matrix4();
    gl.uniformMatrix4fv(u_ModelMatrix, false, identityMat.elements);

    // Draw dirt cubes (you'll need to update this to include normal data)
    gl.uniform1i(u_whichTexture, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_dirtVertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    
    // For normal data - either generate appropriate normals or use a default
    // Since we're using flat shading for blocks, we can use default normals
    // This is simplification - for better results you would generate proper normals
    const defaultNormals = new Float32Array(g_dirtVertices.length);
    // Fill with up-facing normals as default
    for (let i = 0; i < defaultNormals.length; i += 9) {
        // Each triangle gets the same normal (for simplicity)
        defaultNormals[i]   = 0; defaultNormals[i+1] = 1; defaultNormals[i+2] = 0;
        defaultNormals[i+3] = 0; defaultNormals[i+4] = 1; defaultNormals[i+5] = 0;
        defaultNormals[i+6] = 0; defaultNormals[i+7] = 1; defaultNormals[i+8] = 0;
    }
    
    let normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, defaultNormals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, g_dirtUVBuffer);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, g_dirtVertices.length/3);

    // Draw grass cubes - similar approach with normals
    gl.uniform1i(u_whichTexture, 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_grassVertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    
    const grassNormals = new Float32Array(g_grassVertices.length);
    // Fill with up-facing normals
    for (let i = 0; i < grassNormals.length; i += 9) {
        grassNormals[i]   = 0; grassNormals[i+1] = 1; grassNormals[i+2] = 0;
        grassNormals[i+3] = 0; grassNormals[i+4] = 1; grassNormals[i+5] = 0;
        grassNormals[i+6] = 0; grassNormals[i+7] = 1; grassNormals[i+8] = 0;
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, grassNormals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, g_grassUVBuffer);
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, g_grassVertices.length/3);
}


function drawSkybox() {
    let sky = new Cube();
    sky.textureNum = -2; // Use solid color
    sky.color = [0.53, 0.81, 0.98, 1.0]; // Light sky blue
    
    // Position skybox at camera position
    sky.matrix.translate(
        g_camera.eye.elements[0],
        g_camera.eye.elements[1],
        g_camera.eye.elements[2]
    );
    sky.matrix.scale(100, 100, 100);
    
    // Disable depth testing for sky
    gl.disable(gl.DEPTH_TEST);
    sky.render();
    gl.enable(gl.DEPTH_TEST);
}

function keydown(ev) {
    console.log('Key pressed:', ev.keyCode);
    switch(ev.keyCode) {
        case 87: // W key
            console.log('Moving forward');
            g_camera.moveForward();
            break;
        case 83: // S key
            console.log('Moving backward');
            g_camera.moveBackward();
            break;
        case 65: // A key
            console.log('Moving left');
            g_camera.moveLeft();
            break;
        case 68: // D key
            console.log('Moving right');
            g_camera.moveRight();
            break;
        case 81: // Q key
            console.log('Turning left');
            g_camera.turnLeft();
            break;
        case 69: // E key
            console.log('Turning right');
            g_camera.turnRight();
            break;
    }
    renderAllShapes();
}

function onMouseMove(e) {
    if (!document.pointerLockElement) return;
    g_camera.lookAround(e.movementX, e.movementY);
    renderAllShapes();
}

function renderAllShapes() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set projection matrix
    let projMat = new Matrix4();
    projMat.setPerspective(60, canvas.width/canvas.height, 0.1, 100);
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMat.elements);

    // Set view matrix
    let viewMat = new Matrix4();
    viewMat.setLookAt(
        g_camera.eye.elements[0], g_camera.eye.elements[1], g_camera.eye.elements[2],
        g_camera.at.elements[0], g_camera.at.elements[1], g_camera.at.elements[2],
        g_camera.up.elements[0], g_camera.up.elements[1], g_camera.up.elements[2]
    );
    gl.uniformMatrix4fv(u_ViewMatrix, false, viewMat.elements);

    // Set global rotation
    let globalRotMat = new Matrix4();
    gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);
    
    // Set lighting uniforms
    
    // Point light position (from light cube)
    const lightPos = [
        g_lightCube.matrix.elements[12],
        g_lightCube.matrix.elements[13],
        g_lightCube.matrix.elements[14]
    ];
    gl.uniform3fv(u_LightPosition, lightPos);
    
    // Spotlight position and direction
    const spotlightPos = [
        g_spotlight.matrix.elements[12],
        g_spotlight.matrix.elements[13],
        g_spotlight.matrix.elements[14]
    ];
    gl.uniform3fv(u_SpotlightPosition, spotlightPos);
    
    // Spotlight direction (pointing at demo sphere)
    const spotlightTarget = [0, 3, 0]; // Demo sphere position
    const spotlightDir = [
        spotlightTarget[0] - spotlightPos[0],
        spotlightTarget[1] - spotlightPos[1],
        spotlightTarget[2] - spotlightPos[2]
    ];
    // Normalize direction
    const dirLength = Math.sqrt(
        spotlightDir[0] * spotlightDir[0] + 
        spotlightDir[1] * spotlightDir[1] + 
        spotlightDir[2] * spotlightDir[2]
    );
    spotlightDir[0] /= dirLength;
    spotlightDir[1] /= dirLength;
    spotlightDir[2] /= dirLength;
    gl.uniform3fv(u_SpotlightDirection, spotlightDir);
    
    // Spotlight cutoff angle (in cosine)
    gl.uniform1f(u_SpotlightCutoff, Math.cos(Math.PI / 8)); // 22.5 degrees
    
    // Camera position for specular calculation
    gl.uniform3fv(u_ViewPosition, [
        g_camera.eye.elements[0],
        g_camera.eye.elements[1],
        g_camera.eye.elements[2]
    ]);
    
    // Light color
    gl.uniform3fv(u_LightColor, g_lightColor);
    
    // Toggle flags
    gl.uniform1i(u_LightingEnabled, g_lightingEnabled ? 1 : 0);
    gl.uniform1i(u_SpotlightEnabled, g_spotlightEnabled ? 1 : 0);
    gl.uniform1i(u_NormalVisualization, g_normalVisualization ? 1 : 0);

    // Draw skybox
    drawSkybox();

    // Draw terrain blocks
    drawMap();

    // Draw trees
    g_treeSystem.render(gl, a_Position, a_UV, a_Normal, u_whichTexture);
    
    // Draw demonstration sphere
    g_demoSphere.render();
    
    // Draw light cube
    g_lightCube.render();
    
    // Draw spotlight cube if enabled
    if (g_spotlightEnabled) {
        g_spotlight.render();
    }

    updateFPS();
}

function tick() {
    // Update light position
    g_lightAngle += 0.01;
    if (g_lightAngle > Math.PI * 2) g_lightAngle = 0;
    
    // Set light position in a circular path
    const lightRadius = 5.0;
    const lightHeight = 5.0;
    const lightX = Math.cos(g_lightAngle) * lightRadius;
    const lightZ = Math.sin(g_lightAngle) * lightRadius;
    
    // Update light cube matrix
    g_lightCube.matrix.setIdentity();
    g_lightCube.matrix.translate(lightX, lightHeight, lightZ);
    g_lightCube.matrix.scale(0.2, 0.2, 0.2);
    
    // Set spotlight position and direction (fixed, pointing at the demo sphere)
    g_spotlight.matrix.setIdentity();
    g_spotlight.matrix.translate(5, 8, 5);
    g_spotlight.matrix.scale(0.2, 0.2, 0.2);
    
    renderAllShapes();
    requestAnimationFrame(tick);
}

function initMouseControls() {
    const canvas = document.getElementById('webgl');
    
    // Request pointer lock when canvas is clicked
    canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
    });
    
    // Setup pointer lock change handler
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
            document.addEventListener('mousemove', onMouseMove);
        } else {
            document.removeEventListener('mousemove', onMouseMove);
        }
    });

    // Handle block manipulation
    canvas.addEventListener('mousedown', (ev) => {
        if (document.pointerLockElement === canvas) {
            if (ev.button === 0) { // Left click
                if (g_blockSystem.addBlock(g_camera)) {
                    updateWorldGeometry(); // Update only the geometry
                    setupBuffers();
                }
            } else if (ev.button === 2) { // Right click
                if (g_blockSystem.removeBlock(g_camera)) {
                    updateWorldGeometry(); // Update only the geometry
                    setupBuffers();
                }
            }
            renderAllShapes();
        }
    });
}

function main() {
    g_fpsCounter = new FPSCounter();
    setupWebGL();
    connectVariablesToGLSL();
    initTextures();
    initializeMap();    // Must come before setupBuffers
    setupBuffers();

    g_treeSystem = new TreeSystem();
    g_treeSystem.generateTrees(g_map);
    g_treeSystem.setupBuffers(gl);
    
    g_blockSystem = new BlockSystem(g_map);
    g_camera = new Camera();

    // Initialize lighting
    initializeLighting();
    setupLightingEventListeners()

    initMouseControls();
    document.onkeydown = keydown;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    requestAnimationFrame(tick);
}



function updateFPS() {
    if (!g_fpsCounter) {
        console.error('FPS Counter not initialized');
        return;
    }
    const fps = g_fpsCounter.tick();
    const fpsDisplay = document.getElementById('numdot');
    if (fpsDisplay) {
        fpsDisplay.innerHTML = `FPS: ${fps}`;
    }
}

function sendTextToHTML(text, htmlID) {
    let htmlElement = document.getElementById(htmlID);
    if (!htmlElement) {
        console.error('Failed to get HTML element:', htmlID);
        return;
    }
    htmlElement.innerHTML = text;
}