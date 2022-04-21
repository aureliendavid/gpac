LOCAL_PATH:= $(call my-dir)

include $(CLEAR_VARS)
include $(LOCAL_PATH)/../common.mk

LOCAL_MODULE    := gpacCmdWrapper
LOCAL_MODULE_FILENAME	:= libgpaccmdwrapper

LOCAL_C_INCLUDES 	+= $(LOCAL_PATH)/../../../../include
LOCAL_C_INCLUDES 	+= $(LOCAL_PATH)/../libgpac/

LOCAL_LDLIBS    += -L../libs/$(TARGET_ARCH_ABI)
LOCAL_LDLIBS    += -llog -lgpac

#LOCAL_CFLAGS +=	-DGPAC_GUI_ONLY
LOCAL_CFLAGS +=	-DDEBUG_MODE

LOCAL_SRC_FILES :=  ../../../../applications/gpac/main.c \
                    ../../../../applications/gpac_cmd_android/app/src/main/jni/wrapper.c 

include $(BUILD_SHARED_LIBRARY)
