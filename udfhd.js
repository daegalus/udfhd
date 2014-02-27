var fs = require("fs");
var os = require("os");
var cproc = require("child_process");
var std = require("std");

var argv = require('yargs').argv._;

if (argv.length < 1) {
  console.log("Usage: udfhd block_device [label]");
  console.log("\nEx: udfhd /dev/disk2 SomeUSBHD");
  console.log("    udfhd /dev/disk2");
  console.log("\nNote: Label defaults to 'UDF' if not provided");
  return;
}

var sector_size = 512;
var device = argv[0];
var label = argv[1] || "UDF";
var udf = chooseTool();

function chooseTool() {
  if (fs.existsSync("/usr/bin/mkudffs")) {
    return {
      path: "/usr/bin/mkudffs",
      type: "mkudffs"
    };
  }
  else if (fs.existsSync("/sbin/newfs_udf")) {
    return {
      path: "/sbin/newfs_udf",
      type: "newfs_udf"
    };
  }
  else {
    throw "Could not find a UDF tool.";
  }
}

function repeat(str, num) {
  return new Array(num).join(str);
}
function encode_lba(lba) {
   return std.pack("V", lba);
}

function encode_chs(lba, heads, sects) {
  var C = lba/(heads*sects);
  if (C > 1023) {
    C = 1023
  }
  var S = 1+(lba % sects);
  var H = (lba/sects) % heads;
  return std.pack("CCC", H & 255, (S & 63) | (((C / 256) & 3) * 64), C & 255);
}

function encode_entry(begin_sect, size_sect, bootable, type, heads, sects) {
  if (size_sect === 0) {
    return repeat(std.pack("C", 0));
  }

  var res = "";
  if (bootable) {
    res = std.pack("C", 0x80)
  }
  else {
    res = std.pack("C", 0)
  }

  res += encode_chs(begin_sect, heads, sects);
  res += std.pack("C", type);
  res += encode_chs(begin_sect + size_sect - 1, heads, sects);
  res += encode_lba(begin_sect);
  res += encode_lba(size_sect);
  return res;
}

function generate_fmbr(maxlba, heads, sects) {
  maxlba -= maxlba % (heads * sects);
  var res = repeat(std.pack("C", 0), 440); // code section
  res += std.pack("V", 0); // Disk Signature
  res += repeat(std.pack("C", 0), 2); // Padding
  res += encode_entry(0, maxlba, 0, 0x0B, heads, sects); // primary partition spanning whole disk
  res += repeat(std.pack("C", 0), 48); // 3 unused partition entries
  res += std.pack("C", 0x55); // signature part 1
  res += std.pack("C", 0xAA); // signature part 2
  return [res, maxlba];
}

function getDeviceSize(device, callback) {
  if (os.platform() === "darwin") {
    cproc.exec("diskutil info " + device + " | grep \"Total Size:\"", function(err, stdout, stderr) {
      if (err != undefined || stderr != undefined) {
        console.log(stderr);
        console.log(err);
        return;
      }
      var size = stdout.trim().split(":")[1].trim();
      var re = /.+\(([\d]+).+\).+/;
      var match = re.exec(size);
      callback(match[1])
    });
  }
  if (os.platform() === "linux") {
    cproc.exec("fdisk -l | grep Disk | grep " + device, function(err, stdout, stderr) {
      if (err != undefined || stderr != undefined) {
        console.log(stderr);
        console.log(err);
        return;
      }
      var size = stdout.trim();
      var re = /.+, ([\d]+).+/;
      var match = re.exec(size);
      callback(match[1]);
    });
  }
}

function makeUDF(maxlba) {
  if (udf.type === "mkudffs") {
    cproc.exec(udf.path + " --blocksize=" + sector_size + " --udfrev=0x0201 --lvid=" + label + " --vid" + label + " --media-type=hd --utf8 " + device + " " + maxlba, finishOutput);
  }
  if (udf.type === "newfs_udf") {
    cproc.exec(udf.path + " -b " + sector_size + " -m blk -t ow -s " + maxlba + " -r 2.01 -v " + label + " --enc utf8 " + device, finishOutput);
  }
}

function finishOutput(err, stdout, stderr) {
  if (err === undefined) {
    console.log(err);
    return
  }
  if (stderr === undefined) {
    console.log(stderr);
  }
  console.log(stdout);
  console.log("Done.");
}

function ask(question, format, callback) {
  var stdin = process.stdin, stdout = process.stdout;

  stdin.resume();
  stdout.write(question + ": ");

  stdin.once('data', function(data) {
    data = data.toString().trim();

    if (format.test(data)) {
      callback(data);
    } else {
      stdout.write("It should match: "+ format +"\n");
      ask(question, format, callback);
    }
  });
}

ask("Are you sure you wish to format " + device + " to UDF?", /.+/, function(answer) {
  if (answer.toLowerCase() === "yes") {
    getDeviceSize(device, function(size) {
      console.log(size);
      var fmbr = generate_fmbr(size/sector_size, 255, 63);
      var fmbr_val = fmbr[0];
      var maxlba = fmbr[1];

      var fd = fs.openSync(device, "w");
      console.log("Writing MBR...");
      fs.writeSync(fd, fmbr_val);
      console.log("Done.");
      console.log("Cleaning first 4096 sectors....");
      for (var i = 0; i < 4096; i++) {
        fs.writeSync(fd, repeat(std.pack("C", 0), sector_size));
      }
      console.log("Done.");
      fs.close(fd);

      console.log("Creating " + maxlba + "-sector UDF v2.01 filesystem with label '" + label + "' on " + device + " using " + udf.type);
      makeUDF(maxlba);
    });
  } else {
    console.log("No operations were done. Exiting.");
    process.exit();
  }
});

