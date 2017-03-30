## udfhd

[![Join the chat at https://gitter.im/Daegalus/udfhd](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/Daegalus/udfhd?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

A tool to create a UDF hard drive or usb drive that will be properly
mounted on Windows, OSX, and Linux.

UDF has the potential to replace FAT32 or NTFS on USB drives, it has a lot
of modern features and is supported by all OSes for Read/Write at v2.01 of UDF

This tool is based on the Perl script by Pieter @ http://sipa.ulyssis.org/2010/02/filesystems-for-portable-disks/

### Usage

Install globally:
```
npm install -g udfhd
```

or run locally after cloning.

To format a drive, use the following command as root.
WARNING: There is no protection on what drive you choose. Be careful which path you provide.
I am not responsible if you wipe your entire drive.
This is a destructive operation.

```
udfhd /dev/sda AwesomeHD
```

udfhd takes 2 parameters. A required device and an optional label for the drive.
I default to "UDF" if you don't provide a label.

### TODO
After making sure it works on Linux, I plan to make it work on Windows.
Theoretically it should work just fine with \\.\PhysicalDriveX pathes on Windows.

### License
This is released on the MIT License. For full details, read the LICENSE file.