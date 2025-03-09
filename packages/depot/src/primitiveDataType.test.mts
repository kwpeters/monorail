import { Int8, UInt8, Int16, UInt16, Int32, UInt32, Int64, UInt64, Float32, Float64 } from "./primitiveDataType.mjs";

describe("Int8", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int8.dataTypeMin).toEqual(-128);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int8.dataTypeMax).toEqual(127);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int8.fromString("").failed).toBeTrue();
                expect(Int8.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int8.fromString("-129").failed).toBeTrue();
                // Over range
                expect(Int8.fromString("128").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(Int8.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int8.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int8.create(-129).failed).toBeTrue();
                // Over range
                expect(Int8.create(128).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(Int8.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int8.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int8.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});

describe("UInt8", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt8.dataTypeMin).toEqual(0);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt8.dataTypeMax).toEqual(255);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt8.fromString("").failed).toBeTrue();
                expect(UInt8.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt8.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt8.fromString("256").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(UInt8.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt8.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt8.create(-1).failed).toBeTrue();
                // Over range
                expect(UInt8.create(256).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(UInt8.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt8.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt8.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});

describe("Int16", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int16.dataTypeMin).toEqual(-32768);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int16.dataTypeMax).toEqual(32767);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int16.fromString("").failed).toBeTrue();
                expect(Int16.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int16.fromString("-32769").failed).toBeTrue();
                // Over range
                expect(Int16.fromString("32768").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(Int16.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int16.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int16.create(-32769).failed).toBeTrue();
                // Over range
                expect(Int16.create(32768).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(Int16.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int16.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int16.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});

describe("UInt16", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt16.dataTypeMin).toEqual(0);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt16.dataTypeMax).toEqual(65535);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt16.fromString("").failed).toBeTrue();
                expect(UInt16.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt16.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt16.fromString("65536").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(UInt16.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt16.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt16.create(-1).failed).toBeTrue();
                // Over range
                expect(UInt16.create(65536).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(UInt16.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt16.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt16.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});

describe("Int32", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int32.dataTypeMin).toEqual(-2147483648);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int32.dataTypeMax).toEqual(2147483647);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int32.fromString("").failed).toBeTrue();
                expect(Int32.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int32.fromString("-2147483649").failed).toBeTrue();
                // Over range
                expect(Int32.fromString("2147483648").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(Int32.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int32.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int32.create(-2147483649).failed).toBeTrue();
                // Over range
                expect(Int32.create(2147483648).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(Int32.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int32.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int32.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});

describe("UInt32", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt32.dataTypeMin).toEqual(0);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt32.dataTypeMax).toEqual(4294967295);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt32.fromString("").failed).toBeTrue();
                expect(UInt32.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt32.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt32.fromString("4294967296").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(UInt32.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt32.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt32.create(-1).failed).toBeTrue();
                // Over range
                expect(UInt32.create(4294967296).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(UInt32.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt32.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt32.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});

describe("Int64", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int64.dataTypeMin).toEqual(BigInt("-9223372036854775808"));
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int64.dataTypeMax).toEqual(BigInt("9223372036854775807"));
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int64.fromString("").failed).toBeTrue();
                expect(Int64.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int64.fromString("-9223372036854775809").failed).toBeTrue();
                // Over range
                expect(Int64.fromString("9223372036854775808").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int64.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int64.create(BigInt("-9223372036854775809")).failed).toBeTrue();
                // Over range
                expect(Int64.create(BigInt("9223372036854775808")).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int64.create(BigInt(5));
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int64.create(BigInt(0)).throwIfFailed();
                expect(inst.value).toEqual(BigInt(0));
            });

        });

    });

});

describe("UInt64", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt64.dataTypeMin).toEqual(BigInt(0));
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt64.dataTypeMax).toEqual(BigInt("18446744073709551615"));
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt64.fromString("").failed).toBeTrue();
                expect(UInt64.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt64.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt64.fromString("18446744073709551616").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt64.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });
        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt64.create(BigInt(-1)).failed).toBeTrue();
                // Over range
                expect(UInt64.create(BigInt("18446744073709551616")).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt64.create(BigInt(5));
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt64.create(BigInt(0)).throwIfFailed();
                expect(inst.value).toEqual(BigInt(0));
            });

        });

    });

});

describe("Float32", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Float32.dataTypeMin).toEqual(-3.4028235e38);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Float32.dataTypeMax).toEqual(3.4028235e38);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Float32.fromString("").failed).toBeTrue();
                expect(Float32.fromString("a1bc").failed).toBeTrue();
            });


            it("succeeds when given a numeric string", () => {
                const res = Float32.fromString("5.2");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });
        });


        describe("create()", () => {

            it("succeeds when input is a valid float", () => {
                const res = Float32.create(5.2);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Float32.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});

describe("Float64", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Float64.dataTypeMin).toEqual(-Number.MAX_VALUE);
            });
        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Float64.dataTypeMax).toEqual(Number.MAX_VALUE);
            });
        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Float64.fromString("").failed).toBeTrue();
                expect(Float64.fromString("a1bc").failed).toBeTrue();
            });


            it("succeeds when given a numeric string", () => {
                const res = Float64.fromString("5.2");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });
        });


        describe("create()", () => {

            it("succeeds when input is a valid float", () => {
                const res = Float64.create(5.2);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });
        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Float64.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});
