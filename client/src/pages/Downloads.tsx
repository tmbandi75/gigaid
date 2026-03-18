import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileJson, FileCode, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { isNativePlatform } from "@/lib/platform";

interface DownloadFile {
  id: string;
  name: string;
  description: string;
  type: string;
  size: string;
  path: string;
}

export default function Downloads() {
  const isMobile = useIsMobile();
  const disableDownloads = false;
  const { data, isLoading } = useQuery<{ files: DownloadFile[] }>({
    queryKey: QUERY_KEYS.downloads(),
  });

  const handleDownload = (file: DownloadFile) => {

    if (isNativePlatform()) {
      const absoluteUrl = file.path.startsWith("http")
        ? file.path
        : new URL(file.path, window.location.origin).toString();
      window.open(absoluteUrl, "_blank");
      return;
    }

    const link = document.createElement("a");
    link.href = file.path;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "json":
        return <FileJson className="h-8 w-8 text-yellow-500" />;
      case "dot":
        return <FileCode className="h-8 w-8 text-blue-500" />;
      default:
        return <FileCode className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const renderMobileHeader = () => (
    <div className="px-4 py-6">
      <h1 className="text-3xl font-bold tracking-tight" data-testid="text-downloads-title">
        Downloads
      </h1>
      <p className="text-muted-foreground mt-2">
        Download GigAid project files including architecture diagrams and configuration files.
      </p>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center">
            <Download className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-downloads-title">
              Downloads
            </h1>
            <p className="text-sm text-muted-foreground">
              Download GigAid project files including architecture diagrams and configuration files.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (disableDownloads) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-downloads">
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}

      <div className={isMobile ? "flex-1 px-4 py-6 space-y-4" : "flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-6"}>
        <div className="grid gap-4">
          {data?.files.map((file) => (
            <Card key={file.id} className="hover-elevate" data-testid={`card-download-${file.id}`}>
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                {getFileIcon(file.type)}
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {file.name}
                    <Badge variant="secondary" className="text-xs">
                      {file.type.toUpperCase()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{file.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <span className="text-sm text-muted-foreground">{file.size}</span>
                <Button
                  onClick={() => handleDownload(file)}
                  size="sm"
                  data-testid={`button-download-${file.id}`}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h2 className="font-semibold mb-2">About these files</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              <strong>DOT files</strong> can be visualized using Graphviz or online tools like{" "}
              <a
                href="https://dreampuf.github.io/GraphvizOnline/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Graphviz Online
              </a>
            </li>
            <li>
              <strong>JSON files</strong> contain structured data about the project configuration and data models
            </li>
          </ul>
        </div>

        {/* Extra padding to clear the fixed bottom navigation bar */}
        <div className={isMobile ? "h-20" : "h-8"} />
      </div>
    </div>
  );
}
