let formidable = require('formidable')
let db = require('../models/db.js')
let md5 = require('../models/md5.js')
let path = require('path')
let fs = require('fs')
let gm = require('gm')

exports.showIndex = function (req, res, next) {
  //检索数据库，查找此人的头像
  if (req.session.login == "1") {
    //如果登陆了
    var username = req.session.username;
    var login = true;
  } else {
    //没有登陆
    var username = ""; //制定一个空用户名
    var login = false;
  }
  //已经登陆了，那么就要检索数据库，查登陆这个人的头像
  db.find("users", {
    username: username
  }, function (err, result) {
    if (result.length == 0) {
      var avatar = "moren.jpg";
    } else {
      var avatar = result[0].avatar;
    }
    res.render("index", {
      "login": login,
      "username": username,
      "active": "首页",
      "avatar": avatar //登录人的头像
    });
  });
};

exports.showRegist = function (req, res, next) {
  res.render('regist', {
    "login": req.session.login == "1" ? true : false,
    "username": req.session.login == "1" ? req.session.username : '',
    "active": "注册"
  })
}

exports.doRegist = function (req, res, next) {
  // 得到用户填写的东西
  let form = new formidable.IncomingForm();

  form.parse(req, function (err, fields, files) {
    // 得到表单之后做的事情
    let username = fields.username
    let password = fields.password

    // 查询数据库是否有这个人
    db.find('users', {
      "username": username
    }, function (err, result) {
      if (err) {
        res.send('-3') // 服务器错误
        return
      }
      if (result.length != 0) {
        res.send('-1') // 用户已存在
        return
      }
      if (username == "" || password == "") {
        res.send("-4") // 账号不符合规范
        return
      }
      password = md5(password)
      // 可以插入用户
      db.insertOne('users', {
        "username": username,
        "password": password,
        "avatar": "moren.jpg"
      }, function (err, result) {
        if (err) {
          res.send('-3') // 服务器错误
          return
        }
        req.session.login = "1"
        req.session.username = username

        res.send('1') // 注册成功
      })
    })
    // 保存这个人
  });
}

exports.showLogin = function (req, res, next) {
  res.render('login', {
    "login": req.session.login == "1" ? true : false,
    "username": req.session.login == "1" ? req.session.username : '',
    "active": "登陆"
  })
}

exports.doLogin = function (req, res, next) {
  let form = new formidable.IncomingForm();

  form.parse(req, function (err, fields, files) {
    // 得到表单之后做的事情
    let username = fields.username
    let password = fields.password
    password = md5(password)

    db.find('users', {
      "username": username,
    }, function (err, result) {
      if (err) {
        res.send('-3') // 服务器错误
      }
      if (result.length == 0) {
        res.send('-1')
        return
      }
      if (password == result[0].password) {
        req.session.login = "1"
        req.session.username = username
        res.send('1') // 登陆成功
        return
      } else {
        res.send('-2') //密码错误
      }
    })
  })
}

//设置头像页面，必须保证此时是登陆状态
exports.showSetavatar = function (req, res, next) {
  //必须保证登陆
  if (req.session.login != "1") {
    res.end("非法闯入，这个页面要求登陆！");
    return;
  }
  res.render("setavatar", {
    "login": true,
    "username": req.session.username,
    "active": "修改头像"
  });
};

//设置头像
exports.dosetavatar = function (req, res, next) {
  //必须保证登陆
  if (req.session.login != "1") {
    res.end("非法闯入，这个页面要求登陆！");
    return;
  }

  var form = new formidable.IncomingForm();
  form.uploadDir = path.normalize(__dirname + "/../avatar");
  form.parse(req, function (err, fields, files) {
    var oldpath = files.touxiang.path;
    var newpath = path.normalize(__dirname + "/../avatar") + "\\" + req.session.username + ".jpg";
    fs.rename(oldpath, newpath, function (err) {
      if (err) {
        res.send("失败");
        return;
      }
      req.session.avatar = req.session.username + ".jpg";
      //跳转到切的业务
      res.redirect("/cut");
    });
  });
}

//显示切图页面
exports.showcut = function (req, res) {
  //必须保证登陆
  if (req.session.login != "1") {
    res.end("非法闯入，这个页面要求登陆！");
    return;
  }
  res.render("cut", {
    avatar: req.session.avatar
  })
};

//执行切图
exports.docut = function (req, res, next) {
  //必须保证登陆
  if (req.session.login != "1") {
    res.end("非法闯入，这个页面要求登陆！");
    return;
  }
  //这个页面接收几个GET请求参数
  //w、h、x、y
  var filename = req.session.avatar;
  var w = req.query.w;
  var h = req.query.h;
  var x = req.query.x;
  var y = req.query.y;
  console.log(req.session.username,req.session.avatar)

  gm("./avatar/" + filename)
    .crop(w, h, x, y)
    .resize(150, 150, "!")
    .write("./avatar/" + filename, function (err) {
      if (err) {
        console.log(err)
        res.send("-1");
        return;
      }
      //更改数据库当前用户的avatar这个值
      db.updateMany("users", {
        "username": req.session.username
      }, {
        $set: {
          "avatar": req.session.avatar
        }
      }, function (err, results) {
        console.log("hahah")
        res.send("1");
      });
    });
}

//发表说说
exports.doPost = function (req, res, next) {
  //必须保证登陆
  if (req.session.login != "1") {
    res.end("非法闯入，这个页面要求登陆！");
    return;
  }
  //用户名
  var username = req.session.username;

  //得到用户填写的东西
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
    //得到表单之后做的事情
    var content = fields.content;

    //现在可以证明，用户名没有被占用
    db.insertOne("posts", {
      "username": username,
      "datetime": new Date(),
      "content": content
    }, function (err, result) {
      if (err) {
        res.send("-3");
        return;
      }
      res.send("1");
    });
  });
};

//列出所有说说，有分页功能
exports.getAllShuoshuo = function (req, res, next) {
  //这个页面接收一个参数，页面
  var page = req.query.page;
  db.find("posts", {}, {
    "pageamount": 20,
    "page": page,
    "sort": {
      "datetime": -1
    }
  }, function (err, result) {
    res.json(result);
  });
};
//列出某个用户的信息
exports.getuserinfo = function (req, res, next) {
  //这个页面接收一个参数，页面
  var username = req.query.username;
  db.find("users", {
    "username": username
  }, function (err, result) {
    if (err || result.length == 0) {
      res.json("");
      return;
    }
    var obj = {
      "username": result[0].username,
      "avatar": result[0].avatar,
      "_id": result[0]._id,
    };
    res.json(obj);
  });
};

//说说总数
exports.getshuoshuoamount = function (req, res, next) {
  db.getAllCount("posts", function (count) {
    res.send(count.toString());
  });
};

//显示某一个用户的个人主页
exports.showUser = function (req, res, next) {
  var user = req.params["user"];
  db.find("posts", {
    "username": user
  }, function (err, result) {
    db.find("users", {
      "username": user
    }, function (err, result2) {
      res.render("user", {
        "login": req.session.login == "1" ? true : false,
        "username": req.session.login == "1" ? req.session.username : "",
        "user": user,
        "active": "我的说说",
        "cirenshuoshuo": result,
        "cirentouxiang": result2[0].avatar
      });
    });
  });
}

//显示所有注册用户
exports.showuserlist = function (req, res, next) {
  db.find("users", {}, function (err, result) {
    res.render("userlist", {
      "login": req.session.login == "1" ? true : false,
      "username": req.session.login == "1" ? req.session.username : "",
      "active": "成员列表",
      "suoyouchengyuan": result
    });
  });
}