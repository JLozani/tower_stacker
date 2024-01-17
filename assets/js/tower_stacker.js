class TowerStacker {
    static #BOXSIZE = 3;
    static #BOXHEIGHT = 1;
    static #BOXWEIGHT = 3;
    static #BOXSTART = -5;

    static #WIDTH = 10;
    static #HEIGHT = TowerStacker.#WIDTH * (window.innerHeight / window.innerWidth);
    
    #scene;
    #world; 
    #camera;
    #renderer;

    #contentHTML;

    #score;
    #scoreHTML;

    #modalHTML;
    #modalScoreHTML;
    
    #fullscreenButtonHTML;

    #stack;
    #overhang;

    #clock;
    #oldElapsedTime;
    
    #running;
    #randomDirection;
    #autoplayRandom;

    constructor() {
        this.#stack = [];
        this.#overhang = [];

        this.#scene = new THREE.Scene();
        this.#world = new CANNON.World();

        this.#clock = new THREE.Clock();
        this.#running = false;
        this.#randomDirection = -1;

        this.#contentHTML = document.querySelector('.content');
        this.#scoreHTML = document.querySelector('.content__score');
        this.#modalHTML = document.querySelector('.content__modal');
        this.#modalScoreHTML = document.querySelector('.content__modal__text__top__score');
        this.#fullscreenButtonHTML = document.querySelector('.fullscreen');

        this.#camera = new THREE.OrthographicCamera(TowerStacker.#WIDTH / -2, TowerStacker.#WIDTH / 2, TowerStacker.#HEIGHT / 2, TowerStacker.#HEIGHT / -2, 0.1, 50);
        this.#renderer = new THREE.WebGLRenderer();
        
        this.#world.broadphase = new CANNON.SAPBroadphase(this.#world);
        this.#world.allowSleep = true;
        this.#world.gravity.set(0, - 10, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.#scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 20, 0);
        this.#scene.add(directionalLight);
        
        this.#renderer.setSize(window.innerWidth, window.innerHeight);
        this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.#contentHTML.prepend(this.#renderer.domElement);

        this.#startGame();

        window.addEventListener('resize', () => {
            TowerStacker.#HEIGHT = TowerStacker.#WIDTH * (window.innerHeight / window.innerWidth);

            this.#camera.top = TowerStacker.#HEIGHT / 2;
            this.#camera.bottom = TowerStacker.#HEIGHT / -2;
            this.#camera.updateProjectionMatrix();

            this.#renderer.setSize(window.innerWidth, window.innerHeight);
            this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        });

        this.#contentHTML.addEventListener('touchstart', (event) => {
            event.preventDefault();

            this.#eventClicked();
        }, { passive: false });

        this.#contentHTML.addEventListener('mousedown', this.#eventClicked);

        window.addEventListener('keydown', (event) => { 
            if(event.key === ' ') {
                this.#eventClicked();
            }
        });

        this.#fullscreenButtonHTML.addEventListener('click', () => {
            if ((document.fullScreenElement && document.fullScreenElement !== null) || (!document.mozFullScreen && !document.webkitIsFullScreen)) {
                if (document.documentElement.requestFullScreen) {
                    document.documentElement.requestFullScreen();
                } else if (document.documentElement.mozRequestFullScreen) {
                    document.documentElement.mozRequestFullScreen();
                } else if (document.documentElement.webkitRequestFullScreen) {
                    document.documentElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
                }
            } else {
                if (document.cancelFullScreen) {
                    document.cancelFullScreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitCancelFullScreen) {
                    document.webkitCancelFullScreen();
                }
            }

            this.#fullscreenButtonHTML.classList.toggle('fullscreen--close');
        });
    }

    #eventClicked = () => {
        if(this.#running) {
            this.#continueGame();
            return;
        }
        
        this.#running = true;
        this.#scoreHTML.classList.toggle('content__score--show');
        this.#modalHTML.classList.toggle('content__modal--hide');
        
        this.#startGame();
    }

    #startGame = () => {
        this.#renderer.setAnimationLoop(null);

        for(const element of this.#stack) {
            this.#scene.remove(element.threejs);
            this.#world.removeBody(element.cannonjs);
        }

        for(const element of this.#overhang) {
            this.#scene.remove(element.threejs)
            this.#world.removeBody(element.cannonjs)
        }

        this.#stack = [];
        this.#overhang = [];

        this.#renderer.renderLists.dispose();

        this.#camera.position.set(5, 5, 5);
        this.#camera.lookAt(0, 1, 0);

        this.#addLayer(0, 0, TowerStacker.#BOXSIZE, TowerStacker.#BOXSIZE);
        this.#addLayer(TowerStacker.#BOXSTART, 0, TowerStacker.#BOXSIZE, TowerStacker.#BOXSIZE, 'x');
        
        this.#clock.start();
        this.#oldElapsedTime = 0;
        this.#autoplayRandom = (Math.random() - 0.5) * 0.1;

        this.#score = 0;
        this.#scoreHTML.innerHTML = '0';

        this.#renderer.setAnimationLoop(this.#animation);
    }

    #continueGame = () => {
        this.#clock.stop();
        this.#clock.start();
        this.#oldElapsedTime = 0;

        this.#randomDirection = Math.sign(Math.random() - 0.5);

        const topLayer = this.#stack[this.#stack.length - 1];
        const previousLayer = this.#stack[this.#stack.length - 2];
        
        const direction = topLayer.direction;

        const delta = topLayer.threejs.position[direction] - previousLayer.threejs.position[direction];

        const overhangSize = Math.abs(delta);

        const size = (direction == 'x' ? topLayer.width : topLayer.depth);

        const overlap = size - overhangSize;

        if(overlap > 0) {
            if(this.#running) {
                this.#score += 1;
                this.#scoreHTML.innerHTML = this.#score;
                
                this.#scoreHTML.animate([
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.5)' },
                    { transform: 'scale(1)' }
                ], {
                    duration: 500,
                    easing: 'ease'
                });
            } else {
                this.#autoplayRandom = (Math.random() - 0.5) * (0.1 + (this.#stack.length - 1) / 40);
            }

            if(overhangSize > 0.08) {
                this.#cutBox(topLayer, overlap, size, delta);

                const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
                const overhangX = (direction == 'x' ? topLayer.threejs.position.x + overhangShift : topLayer.threejs.position.x);
                const overhangZ = (direction == 'z' ? topLayer.threejs.position.z + overhangShift : topLayer.threejs.position.z);
                const overhangWidth = (direction == 'x' ? overhangSize : topLayer.width);
                const overhangDepth = (direction == 'z' ? overhangSize : topLayer.depth);

                this.#addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);
            } else {
                topLayer.threejs.position[direction] = previousLayer.threejs.position[direction];
                topLayer.cannonjs.position[direction] = previousLayer.cannonjs.position[direction];
            }

            const newX = (direction == "x" ? topLayer.threejs.position.x : this.#randomDirection * TowerStacker.#BOXSTART);
            const newZ = (direction == "z" ? topLayer.threejs.position.z : this.#randomDirection * TowerStacker.#BOXSTART);
            const newDirection = (direction == "x" ? "z" : "x");

            this.#addLayer(newX, newZ, topLayer.width, topLayer.depth, newDirection);
        } else {
            this.#clock.stop();

            if(this.#running) {
                this.#addOverhang(topLayer.threejs.position.x, topLayer.threejs.position.z, topLayer.width, topLayer.depth);
            
                this.#world.remove(topLayer.cannonjs);
                this.#scene.remove(topLayer.threejs);
                
                this.#modalScoreHTML.innerHTML = 'Score: ' + this.#score;
                this.#scoreHTML.classList.toggle('content__score--show');
                this.#modalHTML.classList.toggle('content__modal--hide');

                this.#running = false;
            } else {
                this.#startGame();
            }
        }
    }

    #addLayer = (x, z, width, depth, direction) => {
        const layer = this.#generateBox(x, TowerStacker.#BOXHEIGHT * this.#stack.length, z, width, depth, false);
        
        layer.direction = direction;

        this.#stack.push(layer);
    }

    #addOverhang = (x, z, width, depth) => {
        const layer = this.#generateBox(x, TowerStacker.#BOXHEIGHT * (this.#stack.length - 1), z, width, depth, true);
    
        this.#overhang.push(layer);
    }

    #generateBox = (x, y, z, width, depth, falls) => {
        const geometry = new THREE.BoxGeometry(width, TowerStacker.#BOXHEIGHT, depth);
        const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(`hsl(${ 30 + (this.#stack.length - (falls ? 1 : 0)) * 10 }, 100%, 50%)`) });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(x, y, z);
        
        this.#scene.add(mesh);

        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, TowerStacker.#BOXHEIGHT / 2, depth / 2));
        const mass = (falls ? TowerStacker.#BOXWEIGHT * (width * depth) / (TowerStacker.#BOXSIZE * TowerStacker.#BOXSIZE) : 0);
        
        const body = new CANNON.Body({ mass, shape });

        body.position.set(x, y, z);
        
        this.#world.addBody(body);

        return {
            threejs: mesh,
            cannonjs: body,
            width,
            depth
        };
    }

    #cutBox = (topLayer, overlap, size, delta) => {
        const direction = topLayer.direction;
        const newWidth = (direction == 'x' ? overlap : topLayer.width);
        const newDepth = (direction == 'z' ? overlap : topLayer.depth);
    
        topLayer.width = newWidth;
        topLayer.depth = newDepth;
    
        topLayer.threejs.scale[direction] = overlap / size;
        topLayer.threejs.position[direction] -= delta / 2;
    
        topLayer.cannonjs.position[direction] -= delta / 2;
    
        const shape = new CANNON.Box(new CANNON.Vec3(newWidth / 2, TowerStacker.#BOXHEIGHT / 2, newDepth / 2));
        topLayer.cannonjs.shapes = [];
        topLayer.cannonjs.addShape(shape);
    }

    #animation = () => {
        const topLayer = this.#stack[this.#stack.length - 1];
        const previousLayer = this.#stack[this.#stack.length - 2];
        const towerHeight = TowerStacker.#BOXHEIGHT * (this.#stack.length - 1) + 4;
        const difference = towerHeight - this.#camera.position.y;

        const elapsedTime = this.#clock.getElapsedTime();
        const deltaTime = elapsedTime - this.#oldElapsedTime;
        this.#oldElapsedTime = elapsedTime;

        const newPosition = (this.#randomDirection * TowerStacker.#BOXSTART * Math.cos(elapsedTime * ( 1.1 + (this.#stack.length - 2) / 40)));
    
        topLayer.threejs.position[topLayer.direction] = newPosition;
        topLayer.cannonjs.position[topLayer.direction] = newPosition;
    
        if(difference > 0) {
            this.#camera.position.y += (Math.pow(difference, 2)) / 100;
        }
    
        this.#world.step(1 / 60, deltaTime, 3);
    
        this.#overhang.forEach((element) => {
            element.threejs.position.copy(element.cannonjs.position);
            element.threejs.quaternion.copy(element.cannonjs.quaternion);
        })

        if(!this.#running) {
            if((this.#randomDirection * topLayer.threejs.position[topLayer.direction]) > (previousLayer.threejs.position[topLayer.direction] - this.#autoplayRandom)) {
                this.#continueGame();
            }
        }
        
        this.#renderer.render(this.#scene, this.#camera);
    }
}