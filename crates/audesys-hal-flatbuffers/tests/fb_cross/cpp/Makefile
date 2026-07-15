# AUDESYS FlatBuffers C++ roundtrip test Makefile
CXX      = clang++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
FB_INC   = -I$(shell pkg-config --variable=includedir flatbuffers 2>/dev/null || echo /usr/local/Cellar/flatbuffers/25.12.19/include)
FB_LIB   = $(shell pkg-config --libs-only-L flatbuffers 2>/dev/null || echo -L/usr/local/Cellar/flatbuffers/25.12.19/lib)
FB_LDL   = -lflatbuffers
GEN_DIR  = generated
TARGET   = roundtrip

.PHONY: all clean run

all: $(TARGET)

$(TARGET): roundtrip.cpp $(GEN_DIR)/hal_value_generated.h
	$(CXX) $(CXXFLAGS) $(FB_INC) -I. roundtrip.cpp $(FB_LIB) $(FB_LDL) -o $@

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(TARGET)
