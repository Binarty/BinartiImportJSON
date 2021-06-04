const clog = console.log.bind(console),
    wlog = console.warn.bind(console),
    elog = console.error.bind(console);

const FS = require('fs'),
    PATH = require('path');

const VERSION = "1.0";

const Reader = (function () {
    function Reader() {
    }

    Reader.prototype.run = function () {
        Helper.loadSettings();
        this.buildInterface();
    };

    Reader.prototype.buildInterface = function () {
        const _this = this;
        const w = this.w = { Form: NewForm() },
            Props = w.Form.Properties;
        w.Form.Width = 250;
        w.Form.Height = 80;
        w.Form.Caption = "Загрузка проекта Binarti";

        w.openFolderButton = Props.NewButton("Выберите папку");
        w.openFolderButton.SetLayout(4, 4, 242, 22);
        w.openFolderButton.Visible = true;
        w.openFolderButton.AlignWithMargins = true;
        w.openFolderButton.Align = AlignType.Top;

        w.openFolderButton.OnClick = function () {
            const defaultFolder = FS.existsSync(Helper.settings.modelsFolderPath) ? Helper.settings.modelsFolderPath : 'C:\\',
                folderPath = system.askFolder('Выберите папку', defaultFolder);

            if (folderPath === '') return;
            Helper.settings.modelsFolderPath = folderPath;
            Helper.saveSettings();
            const filePaths = Helper.getFilePaths([], folderPath);
            _this.readFiles(filePaths);
        };

        w.openFileButton = Props.NewButton("Выберите файл");
        w.openFileButton.SetLayout(4, 4, 242, 22);
        w.openFileButton.Visible = true;
        w.openFileButton.AlignWithMargins = true;
        w.openFileButton.Align = AlignType.Top;

        w.openFileButton.OnClick = function () {
            const filePath = system.askFileName(),
                filePaths = [];
            if (filePath === '') return;
            Helper.settings.modelsFolderPath = PATH.dirname(filePath);
            Helper.saveSettings();
            if (!Helper.isExtensionRight(filePath)) {
                alert('Файл не поддерживается!\nПоддеживаемые форматы: .json');
                return null;
            }

            filePaths.push(filePath);
            _this.readFiles(filePaths);
        };

        w.Form.Show();
    };


    Reader.prototype.readFiles = function (filePaths) {
        let allData = [];
        for (let i = 0; i < filePaths.length; i += 1) {
            const data = this.readFile(filePaths[i]);
            allData = allData.concat(data);
        }
        Builder.run(allData);
    };

    Reader.prototype.readFile = function (filePath) {
        let data = [];
        try {
            data = FS.readFileSync(filePath);
        } catch (e) {
            elog(e);
            return data;
        }

        try {
            data = JSON.parse(data);
        } catch (e) {
            elog(e);
            return [];
        }

        if ((data.creator !== "Binarti" && data.creator !== "BinartiBazisExporter") || !data.list) {
            alert('Некорректный формат файла');
            return [];
        }
        if (data.version > VERSION) {
            alert("Версия скрипта устарела. Работа скрипта может быть нестабильной. Пожалуйста, скачайте новый скрипт с сайта binarti.ru");
        } else if (data.version < VERSION) {
            alert("Версия файла устарела. Работа скрипта может быть нестабильной");
        }
        data = Helper.convertObjectToArray(data.list);

        return data;
    };

    return new Reader();
})();

const Builder = (function () {
    function Builder() {
        this.data = null;
    }

    Builder.prototype.run = function (data) {
        Helper.cleanScene();
        SetCamera(p3dFront);
        this.data = data;
        this.buildAll();
    };

    Builder.prototype.buildAll = function () {
        let offsetX = 0;
        for (let i = 0; i < this.data.length; i += 1) {
            let offsetY = 0;
            for (let j = 0; j < parseInt(this.data[i].quantity); j += 1) {
                if (this.data[i].product === 'rect') {
                    this.buildRect(this.data[i], offsetY, offsetX);
                    this.buildGlued(this.data[i], offsetY, offsetX);
                } else if (this.data[i].product === 'shape') {
                    this.buildShape(this.data[i], offsetY, offsetX);
                    this.buildGlued(this.data[i], offsetY, offsetX);
                } else if (this.data[i].product === 'furniture') {

                } else if (this.data[i].product === 'model') {

                } else if (this.data[i].product === 'module') {

                }
                offsetY += Helper.roundToDot1(this.data[i].width) + 100;
            }
            offsetX += Helper.roundToDot1(this.data[i].height) + 100;
        }

        Action.Commit();
        Action.Finish();
    };

    Builder.prototype.buildRect = function (rect, offsetY, offsetX) {
        const panel = AddPanel(Helper.roundToDot1(rect.height), Helper.roundToDot1(rect.width));
        panel.UserPropertyName = 'data';
        panel.UserProperty['data'] = rect;
        const getWithOrderName = rect.getWithOrder === 'true' ? '(Выдать с заказом)' : '';
        panel.Name = rect.name + getWithOrderName;
        //panel.Sign = 'what write there??';
        panel.MaterialName = rect.material.name;
        panel.Thickness = Helper.roundToDot1(rect.thickness);

        panel.FrontFace = 0; //0 - Сторона 1, 1 - Сторона 2, 2 - Не задана
        panel.TextureOrientation = 1; //0 - Не задана, 1 - по горизонтали, 2 - по вертикали


        //butts
        /*  2
          _____
          |   |
        3 |   | 1
          |   |
          -----
            0
        */
        this.addButtForRect(panel, rect.edgeBottom, 'Кромка Нижняя', 1);
        this.addButtForRect(panel, rect.edgeRight, 'Кромка Правая', 2);
        this.addButtForRect(panel, rect.edgeTop, 'Кромка Верхняя', 3);//2
        this.addButtForRect(panel, rect.edgeLeft, 'Кромка Левая', 0);

        //cuts
        this.addCuts(panel, rect.cuts);

        panel.Build();

        //holes
        this.addHoles(panel, rect.holes);

        this.setPosition(panel, rect.position, offsetY, offsetX);
        this.setRotation(panel, rect.rotation);
    };

    Builder.prototype.buildShape = function (shape, offsetY, offsetX) {
        const panel = AddPanel(),
            c = panel.Contour;
        panel.UserPropertyName = 'data';
        panel.UserProperty['data'] = shape;

        c.Clear();

        for (let key in shape.path) {
            if (!shape.path.hasOwnProperty(key)) continue;
            const p = shape.path[key];
            let x1, y1, x2, y2;

            x1 = parseFloat(p.point0.x);
            y1 = parseFloat(p.point0.y);
            x2 = parseFloat(p.point1.x);
            y2 = parseFloat(p.point1.y);

            if (p.type === 'line') {
                c.AddLine(x1, y1, x2, y2);
            } else if (p.type === 'ellipse') {
                let x3, y3;
                const r = parseFloat(p.r);

                const d = Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2)),
                    h = Math.sqrt(r * r - (d / 2) * (d / 2));
                if (p.clockwise === "1") {
                    x3 = x1 + (x2 - x1) / 2 + h * (y2 - y1) / d;
                    y3 = y1 + (y2 - y1) / 2 - h * (x2 - x1) / d;
                } else {
                    x3 = x1 + (x2 - x1) / 2 - h * (y2 - y1) / d;
                    y3 = y1 + (y2 - y1) / 2 + h * (x2 - x1) / d;
                }

                c.AddArc(NewPoint(x1, y1), NewPoint(x2, y2), NewPoint(x3, y3), p.clockwise === "0");
            }
        }

        if (shape.rotated === '1') {
            c.Rotate(c.Max.x / 2, c.Max.x / 2, -90);
        }

        const getWithOrderName = shape.getWithOrder === 'true' ? '(Выдать с заказом)' : '';
        panel.Name = shape.name + getWithOrderName;
        //panel.Sign = 'what write there??';
        panel.MaterialName = shape.material.name;
        panel.Thickness = Helper.roundToDot1(shape.thickness);
        panel.FrontFace = 0; //0 - Сторона 1, 1 - Сторона 2, 2 - Не задана
        panel.TextureOrientation = 1; //0 - Не задана, 1 - по горизонтали, 2 - по вертикали

        //cuts
        this.addCuts(panel, shape.cuts);

        //holes
        this.addHoles(panel, shape.holes, shape.rotated);

        this.addButtsForShape(panel, shape.edges, shape.path);

        panel.Build();

        this.setPosition(panel, shape.position, offsetY, offsetX);
        this.setRotation(panel, shape.rotation);
    };

    Builder.prototype.buildGlued = function (data, offsetY, offsetX) {
        if (data.glued !== 'true') return null;
        const newDataF = Object.assign({}, data),
            newDataB = Object.assign({}, data);

        const getWithOrderName = newDataF.getWithOrder === 'true' ? '(Выдать с заказом)' : '';

        newDataF.name = newDataF.name + ' - заготовка лицевая' + getWithOrderName;

        newDataF.thickness = parseInt(data.thickness) / 2;
        newDataF.position = Object.assign({}, data.position);
        newDataF.position.z = parseInt(newDataF.position.z) - 100;

        newDataF.cuts = {};
        for (let key in data.cuts) {
            if (!data.cuts.hasOwnProperty(key)) continue;
            if (data.cuts[key].direction === '-z') {
                newDataF.cuts[key] = data.cuts[key];
            }
        }

        newDataF.holes = {};
        for (let key in data.holes) {
            if (!data.holes.hasOwnProperty(key)) continue;
            if (data.holes[key].direction === 'z') continue;
            if (data.holes[key].direction === '-z') {
                newDataF.holes[key] = Object.assign({}, data.holes[key]);
                newDataF.holes[key].z = Helper.roundToDot1(newDataF.holes[key].z) / 2;
            } else {
                const z = Helper.roundToDot1(data.holes[key].z);
                if (z === newDataF.thickness) {//center
                    newDataF.holes[key] = Object.assign({}, data.holes[key]);
                    newDataF.holes[key].z = parseInt(newDataF.thickness) / 2;
                } else if (z > newDataF.thickness) {
                    newDataF.holes[key] = Object.assign({}, data.holes[key]);
                    newDataF.holes[key].z = parseInt(newDataF.thickness) - (parseInt(data.thickness) - parseInt(newDataF.holes[key].z));
                }
            }
        }

        newDataB.name = newDataB.name + ' - заготовка тыльная' + getWithOrderName;

        newDataB.thickness = parseInt(data.thickness) / 2;

        newDataB.position = Object.assign({}, data.position);
        newDataB.position.z = parseInt(newDataB.position.z) - 200;

        newDataB.cuts = {};
        for (let key in data.cuts) {
            if (!data.cuts.hasOwnProperty(key)) continue;

            if (data.cuts[key].direction === 'z') {
                newDataB.cuts[key] = data.cuts[key];
            }
        }

        newDataB.holes = {};
        for (let key in data.holes) {
            if (!data.holes.hasOwnProperty(key)) continue;
            if (data.holes[key].direction === '-z') continue;
            if (data.holes[key].direction === 'z') {
                newDataB.holes[key] = Object.assign({}, data.holes[key]);
                newDataB.holes[key].z = Helper.roundToDot1(newDataB.holes[key].z) / 2;
            } else {
                const z = Helper.roundToDot1(data.holes[key].z);
                if (z < newDataB.thickness) {
                    newDataB.holes[key] = Object.assign({}, data.holes[key]);
                }
            }
        }

        if (data.product === 'rect') {
            this.buildRect(newDataF, offsetY, offsetX);
            this.buildRect(newDataB, offsetY, offsetX);
        } else if (data.product === 'shape') {
            this.buildShape(newDataF, offsetY, offsetX);
            this.buildShape(newDataB, offsetY, offsetX);
        }
    };

    Builder.prototype.setPosition = function (panel, position, offsetY, offsetX) {
        const x = Helper.roundToDot1(position.x) + offsetX,
            y = Helper.roundToDot1(position.y) - offsetY,
            z = Helper.roundToDot1(position.z);
        panel.PositionX = x;
        panel.PositionY = y;
        panel.PositionZ = z;

        const holes = panel.UserProperty['holes'];
        for (let i = 0; i < holes.length; i += 1) {
            holes[i].TranslateGCS(NewVector(x, y, z));
        }
    };

    Builder.prototype.setRotation = function (panel, rotation) {
        panel.RotateGCS(AxisX, Helper.roundToDot1(rotation.x));
        panel.RotateGCS(AxisY, Helper.roundToDot1(rotation.y));
        panel.RotateGCS(AxisZ, Helper.roundToDot1(rotation.z));
    };

    Builder.prototype.addButtForRect = function (panel, edgeData, propName, buttIndex) {
        if (edgeData.id === 'null') return;

        panel.AddButt(Action.Properties.NewButt(propName), buttIndex);

        for (let i = 0; i < panel.Butts.Count; i += 1) {
            if (panel.Butts[i].ElemIndex !== buttIndex) continue;

            panel.Butts[i].Material = edgeData.id + ' - ' + edgeData.name + ' ' + edgeData.thickness + '/' + edgeData.width;
            panel.Butts[i].Thickness = Helper.roundToDot1(edgeData.thickness);
            panel.Butts[i].Width = Helper.roundToDot1(edgeData.width);
            panel.Butts[i].Sign = edgeData.name + edgeData.thickness + '/' + edgeData.width;
            panel.Butts[i].ClipPanel = false;
        }
    };

    Builder.prototype.addButtsForShape = function (panel, edges, path) {
        for (let i in path) {
            if (!path.hasOwnProperty(i)) continue;
            let edge = null;
            for (let j in edges) {
                if (!edges.hasOwnProperty(j)) continue;
                if (edges[j].edgeId === path[i].edgeId) {
                    edge = edges[j];
                    break;
                }
            }
            if (edge) {
                panel.AddButt(Action.Properties.NewButt('Кромка ' + edge.edgeId), parseInt(i));

                for (let k = 0; k < panel.Butts.Count; k += 1) {
                    if (panel.Butts[k].ElemIndex !== parseInt(i)) continue;

                    panel.Butts[k].Material = edge.id + ' - ' + edge.name + ' ' + edge.thickness + '/' + edge.width;
                    panel.Butts[k].Thickness = Helper.roundToDot1(edge.thickness);
                    panel.Butts[k].Width = Helper.roundToDot1(edge.width);
                    panel.Butts[k].Sign = edge.name + edge.thickness + '/' + edge.width;
                    panel.Butts[k].ClipPanel = false;
                }
            }
        }
    };

    Builder.prototype.addCuts = function (panel, cuts) {
        for (let i = 0; i < cuts.length; i += 1) {
            const cut = panel.AddCut(),
                x = Helper.roundToDot1(cuts[i].x),
                y = Helper.roundToDot1(cuts[i].y),
                width = Helper.roundToDot1(cuts[i].width),
                depth = Helper.roundToDot1(cuts[i].depth);

            cut.Sign = '' + width + 'x' + depth + 'mm';
            if (y === 0) {
                cut.Trajectory.AddLine(x, 0, x, panel.ContourHeight);
            } else {
                cut.Trajectory.AddLine(0, y, panel.ContourWidth, y);
            }
            if (cuts[i].direction === '-z') {
                cut.Contour.AddRectangle(0, panel.Thickness, width, panel.Thickness - depth);
            } else {
                cut.Contour.AddRectangle(0, 0, width, depth);
            }
        }
    };

    Builder.prototype.addHoles = function (panel, holes) {
        const result = [];

        for (let i = 0; i < holes.length; i += 1) {
            let furnObj = null;
            if (holes[i].code === 'Minifix') {
                for (let key in holes[i].params) {
                    if (!holes[i].params.hasOwnProperty(key)) continue;

                    furnObj = this.mountHole(holes[i].params[key], panel);
                    if (furnObj) result.push(furnObj);
                }
            } else {
                furnObj = this.mountHole(holes[i].params, panel);
                if (furnObj) result.push(furnObj);
            }
        }
        panel.UserPropertyName = 'holes';
        panel.UserProperty['holes'] = result;
    };

    Builder.prototype.mountHole = function (hParams, panel) {
        let x = Helper.roundToDot1(hParams.x),
            y = Helper.roundToDot1(hParams.y),
            z = Helper.roundToDot1(hParams.z);

        const furn = OpenFurniture(this.getFurnitureFilePath(hParams)),
            furnObj = furn.Mount1(panel, x, y, 0, 0);

        if (!furnObj) {
            alert('Не найден файл фурнитуры: d' + hParams.d + 'x' + hParams.depth);
            return null;
        }

        if (hParams.direction === '-z') {
            furnObj.RotateGCS(AxisX, 180);
        } else if (hParams.direction === 'z') {

        } else if (hParams.direction === '-x') {
            furnObj.RotateGCS(AxisY, -90);
        } else if (hParams.direction === 'x') {
            furnObj.RotateGCS(AxisY, 90);
        } else if (hParams.direction === '-y') {
            furnObj.RotateGCS(AxisX, 90);
        } else if (hParams.direction === 'y') {
            furnObj.RotateGCS(AxisX, -90);
        }
        furnObj.TranslateGCS(NewVector(0, 0, z));
        return furnObj;
    };

    Builder.prototype.getFurnitureFilePath = function (hParams) {
        const name = 'd' + Helper.roundToDot1(hParams.d) + 'x' + hParams.depth;
        return 'assets/holes/' + name + '.f3d';
    };

    return new Builder();
})();

const Helper = (function () {
    function Helper() {
        this.settings = null;
    }

    Helper.prototype.removeDir = function (path) {
        if (FS.existsSync(path)) {
            FS.readdirSync(path).forEach((file, index) => {
                const curPath = PATH.join(path, file);
                if (FS.lstatSync(curPath).isDirectory()) { // recurse
                    this.removeDir(curPath);
                } else { // delete file
                    FS.unlinkSync(curPath);
                }
            });
            FS.rmdirSync(path);
        }
    };

    Helper.prototype.cleanScene = function () {
        for (let i = Model.Count - 1; i > 0; i -= 1) {
            DeleteObject(Model[i]);
        }
    };

    Helper.prototype.roundToDot1 = function (num) {
        return Math.round(parseFloat(num) * 1e1) / 1e1;
    };

    Helper.prototype.roundToDot2 = function (num) {
        return Math.round(parseFloat(num) * 1e2) / 1e2;
    };

    Helper.prototype.loadSettings = function () {
        const _this = this;
        let settings = null;
        try {
            settings = FS.readFileSync('./settings/settings.json');
        } catch (e) {
            this.saveDefaultSettings();
            this.loadSettings();
            return;
        }

        try {
            this.settings = JSON.parse(settings);
        } catch (e) {
            FS.unlinkSync('./settings/settings.json');
            if (!_this.settings['modelsFolderPath']) {
                _this.settings = { modelsFolderPath: 'C:/Users' };
            }
        }
    };

    Helper.prototype.saveDefaultSettings = function () {
        const defaultData = {
            'modelsFolderPath': 'C:/Users'
        };
        this.saveSettings(defaultData);
    };

    Helper.prototype.saveSettings = function (data) {
        FS.writeFileSync('./settings/settings.json', JSON.stringify(data ? data : this.settings));
    };

    Helper.prototype.isExtensionRight = function (path) {
        let ext = PATH.extname(path);
        ext = ext.toLowerCase();
        return ext === '.json';
    };

    Helper.prototype.convertObjectToArray = function (data) {
        const result = [];
        for (let key in data) {
            if (!data.hasOwnProperty(key)) continue;
            result.push(data[key]);
        }
        return result;
    };

    Helper.prototype.getFilePaths = function (filePaths, folder) {
        let path, res = FS.readdirSync(folder, { encoding: 'utf-8', withFileTypes: true });
        for (let i = 0; i < res.length; i += 1) {
            if (folder[folder.length - 1] === '\\') {
                path = folder + res[i];

            } else {
                path = folder + '\\' + res[i];
            }

            if (FS.statSync(path).isDirectory()) {
                filePaths = this.getFilePaths(filePaths, path);
            } else {
                if (!this.isExtensionRight(path)) continue;
                filePaths.push(path);
            }
        }
        return filePaths;
    };

    return new Helper();
})();

Reader.run();
